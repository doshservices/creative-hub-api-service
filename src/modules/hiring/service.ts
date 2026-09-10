import type { ClientSession } from 'mongodb';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../common/errors.js';
import type { ApplicationStatus } from './application.model.js';
import type { ContractStatus } from './contract.model.js';
import type {
  ApplicationDTO,
  ApplicationPage,
  ClientHiringStatsDTO,
  ContractDTO,
  ContractPage,
  CreativeHiringStatsDTO,
  InvitationDTO,
  InvitationPage,
} from './dto.js';

export interface ApplyInput {
  listingId: string;
  message?: string;
}

export interface PageParams {
  limit: number;
  cursor?: string;
}

// Minimal read surface hiring needs from listings — see listings/index.ts, the only import
// path other modules may use to reach that module. Extended with budgetMaxMinor/currency so
// contract creation can fund escrow without reaching into listings' repository/model directly.
export interface ListingReaderPort {
  findById(id: string): Promise<{
    id: string;
    clientAccountId: string;
    status: string;
    budgetMaxMinor: number;
    currency: string;
  } | null>;
}

// Minimal read surface this module needs from `auth` — used only to check accountType against
// the loaded account (for /mine/stats' creative-vs-client branch, and to validate an invitation
// target is actually a creative account), never a client-supplied field. See auth/index.ts.
export interface AccountReaderPort {
  findById(id: string): Promise<{ accountType: string } | null>;
}

export interface ApplicationRepositoryPort {
  generateId(): string;
  create(
    input: {
      id?: string;
      listingId: string;
      clientAccountId: string;
      creativeAccountId: string;
      message?: string;
      status?: ApplicationStatus;
    },
    session?: ClientSession,
  ): Promise<ApplicationDTO>;
  findById(id: string): Promise<ApplicationDTO | null>;
  findByListingAndCreative(
    listingId: string,
    creativeAccountId: string,
  ): Promise<ApplicationDTO | null>;
  listByCreative(creativeAccountId: string, params: PageParams): Promise<ApplicationPage>;
  listByListing(listingId: string, params: PageParams): Promise<ApplicationPage>;
  updateStatus(
    id: string,
    status: ApplicationStatus,
    session?: ClientSession,
  ): Promise<ApplicationDTO | null>;
  countPendingForCreative(creativeAccountId: string): Promise<number>;
  countPendingForClient(clientAccountId: string): Promise<number>;
}

export interface ContractRepositoryPort {
  create(
    input: {
      listingId: string;
      applicationId: string;
      clientAccountId: string;
      creativeAccountId: string;
      escrowHoldEntryId: string | null;
    },
    session?: ClientSession,
  ): Promise<ContractDTO>;
  findById(id: string): Promise<ContractDTO | null>;
  updateStatus(
    id: string,
    status: ContractStatus,
    session?: ClientSession,
  ): Promise<ContractDTO | null>;
  listForAccount(accountId: string, params: PageParams): Promise<ContractPage>;
  countActiveForCreative(creativeAccountId: string): Promise<number>;
}

export interface InvitationRepositoryPort {
  create(input: {
    listingId: string;
    clientAccountId: string;
    creativeAccountId: string;
  }): Promise<InvitationDTO>;
  findById(id: string): Promise<InvitationDTO | null>;
  findByListingAndCreative(
    listingId: string,
    creativeAccountId: string,
  ): Promise<InvitationDTO | null>;
  listByCreative(creativeAccountId: string, params: PageParams): Promise<InvitationPage>;
  updateStatus(
    id: string,
    status: 'pending' | 'accepted' | 'declined',
    session?: ClientSession,
  ): Promise<InvitationDTO | null>;
}

// Escrow money-movement surface hiring needs from `wallet` — see wallet/service.ts (read in
// full before touching this). `hold`/`captureHold` return the ledger entry's own amountMinor/
// currency so callers never have to re-derive "how much was actually held" from a
// possibly-since-edited listing.
export interface WalletMovementResult {
  id: string;
  amountMinor: number;
  currency: string;
}

export interface WalletMovementPort {
  hold(
    accountId: string,
    currency: string,
    amountMinor: number,
    options: { idempotencyKey: string; reference?: string; description?: string },
  ): Promise<WalletMovementResult>;
  captureHold(
    holdEntryId: string,
    options: { idempotencyKey: string; reference?: string; description?: string },
  ): Promise<WalletMovementResult>;
  credit(
    accountId: string,
    currency: string,
    amountMinor: number,
    options: { idempotencyKey: string; reference?: string; description?: string },
  ): Promise<unknown>;
}

// Wraps a Mongo session/transaction across hiring's own collections (applications, contracts,
// invitations) — a plain copy of wallet's TransactionRunnerPort shape (see wallet/service.ts),
// not an import of it: this is generic Mongo-session plumbing, not a wallet domain concern.
export interface TransactionRunnerPort {
  withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T>;
}

export interface AuditRecorderPort {
  record(input: {
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
  }): Promise<unknown>;
}

// In-process pub/sub for cross-module cache maintenance (listings' applicantCount) — see
// src/common/event-bus.ts. Best-effort: a handler throwing never fails the publisher's request.
export interface EventPublisherPort {
  publish<T>(event: string, payload: T): void;
}

export interface ApplicationEventPayload {
  listingId: string;
  applicationId: string;
}

// Once an application reaches one of these, a client (or the talent, for withdraw) can no
// longer change it further.
const TERMINAL_STATUSES: ApplicationStatus[] = ['accepted', 'rejected', 'withdrawn'];
// A talent can only withdraw while a client hasn't already made a final decision.
const WITHDRAWABLE_STATUSES: ApplicationStatus[] = ['pending', 'interview_requested'];

export class HiringService {
  constructor(
    private readonly applications: ApplicationRepositoryPort,
    private readonly contracts: ContractRepositoryPort,
    private readonly invitations: InvitationRepositoryPort,
    private readonly listings: ListingReaderPort,
    private readonly accounts: AccountReaderPort,
    private readonly wallet: WalletMovementPort,
    private readonly transactions: TransactionRunnerPort,
    private readonly audit: AuditRecorderPort,
    private readonly events: EventPublisherPort,
  ) {}

  async apply(creativeAccountId: string, input: ApplyInput): Promise<ApplicationDTO> {
    const listing = await this.listings.findById(input.listingId);
    if (!listing) {
      throw new NotFoundError('Listing not found');
    }
    if (listing.status !== 'open') {
      throw new ConflictError('This listing is no longer open');
    }

    const existing = await this.applications.findByListingAndCreative(
      input.listingId,
      creativeAccountId,
    );
    if (existing) {
      throw new ConflictError('You have already applied to this listing');
    }

    const application = await this.applications.create({
      listingId: input.listingId,
      clientAccountId: listing.clientAccountId,
      creativeAccountId,
      ...(input.message !== undefined ? { message: input.message } : {}),
    });

    this.events.publish<ApplicationEventPayload>('application.created', {
      listingId: application.listingId,
      applicationId: application.id,
    });

    return application;
  }

  async listMyApplications(
    creativeAccountId: string,
    params: PageParams,
  ): Promise<ApplicationPage> {
    return this.applications.listByCreative(creativeAccountId, params);
  }

  async listApplicationsForListing(
    clientAccountId: string,
    listingId: string,
    params: PageParams,
  ): Promise<ApplicationPage> {
    const listing = await this.listings.findById(listingId);
    if (!listing) {
      throw new NotFoundError('Listing not found');
    }
    if (listing.clientAccountId !== clientAccountId) {
      throw new ForbiddenError('You do not own this listing');
    }
    return this.applications.listByListing(listingId, params);
  }

  async updateApplicationStatus(
    clientAccountId: string,
    applicationId: string,
    status: ApplicationStatus,
  ): Promise<ApplicationDTO> {
    const application = await this.applications.findById(applicationId);
    if (!application) {
      throw new NotFoundError('Application not found');
    }
    if (application.clientAccountId !== clientAccountId) {
      throw new ForbiddenError('You do not own the listing this application is for');
    }
    if (TERMINAL_STATUSES.includes(application.status)) {
      throw new ConflictError('This application has already reached a final decision');
    }

    if (status !== 'accepted') {
      const updated = await this.applications.updateStatus(applicationId, status);
      if (!updated) {
        throw new NotFoundError('Application not found');
      }
      return updated;
    }

    // Fund escrow and create the contract BEFORE flipping the application to a terminal state —
    // if the hold fails (e.g. insufficient balance), the application must come back exactly as
    // it was, never 'accepted' with no funded contract behind it.
    const listing = await this.listings.findById(application.listingId);
    if (!listing) {
      throw new NotFoundError('Listing not found');
    }

    let updatedApplication: ApplicationDTO | undefined;
    await this.persistContractWithEscrow(
      clientAccountId,
      listing,
      application.id,
      application.creativeAccountId,
      async (session) => {
        const updated = await this.applications.updateStatus(application.id, 'accepted', session);
        if (!updated) {
          throw new NotFoundError('Application not found');
        }
        updatedApplication = updated;
      },
    );
    // Set by the callback above, which persistContractWithEscrow always awaits before returning.
    return updatedApplication as ApplicationDTO;
  }

  // Talent-owner only, and only while the client hasn't already made a final decision — see
  // WITHDRAWABLE_STATUSES.
  async withdrawApplication(
    creativeAccountId: string,
    applicationId: string,
  ): Promise<ApplicationDTO> {
    const application = await this.applications.findById(applicationId);
    if (!application) {
      throw new NotFoundError('Application not found');
    }
    if (application.creativeAccountId !== creativeAccountId) {
      throw new ForbiddenError('You do not own this application');
    }
    if (!WITHDRAWABLE_STATUSES.includes(application.status)) {
      throw new ConflictError('This application can no longer be withdrawn');
    }

    const updated = await this.applications.updateStatus(applicationId, 'withdrawn');
    if (!updated) {
      throw new NotFoundError('Application not found');
    }

    this.events.publish<ApplicationEventPayload>('application.withdrawn', {
      listingId: updated.listingId,
      applicationId: updated.id,
    });

    return updated;
  }

  async listMyContracts(accountId: string, params: PageParams): Promise<ContractPage> {
    return this.contracts.listForAccount(accountId, params);
  }

  // Client-owner only, only from 'active'. Releases the funded escrow to the creative: the
  // client's hold is captured (finalizing the spend on their wallet — same primitive
  // payments/service.ts uses to finalize a withdrawal), then the exact captured amount/currency
  // is credited to the creative's wallet as a second, separate movement. captureHold alone
  // would only make the money disappear from the client's side — it operates on the wallet the
  // hold was created on and never touches any other account (see wallet/service.ts) — so a
  // standalone credit is required to actually land the funds with the creative. See this
  // module's report/README notes on this deviation from a literal "just call captureHold"
  // reading of the plan.
  async completeContract(clientAccountId: string, contractId: string): Promise<ContractDTO> {
    const contract = await this.contracts.findById(contractId);
    if (!contract) {
      throw new NotFoundError('Contract not found');
    }
    if (contract.clientAccountId !== clientAccountId) {
      throw new ForbiddenError('You do not own this contract');
    }
    if (contract.status !== 'active') {
      throw new ConflictError('Only an active contract can be completed');
    }
    if (!contract.escrowHoldEntryId) {
      // Defensive: should be unreachable for any contract created by this codebase (escrow is
      // funded unconditionally on acceptance) — surfaced clearly rather than crediting an
      // arbitrary amount if it ever happens.
      throw new ConflictError('This contract has no funded escrow to release');
    }

    const captureKey = `hiring:contract-capture:${contract.id}`;
    const capture = await this.wallet.captureHold(contract.escrowHoldEntryId, {
      idempotencyKey: captureKey,
      reference: contract.id,
      description: 'Escrow capture on contract completion',
    });

    const payoutKey = `hiring:contract-payout:${contract.id}`;
    await this.wallet.credit(contract.creativeAccountId, capture.currency, capture.amountMinor, {
      idempotencyKey: payoutKey,
      reference: contract.id,
      description: 'Contract payout',
    });

    const updated = await this.contracts.updateStatus(contract.id, 'completed');
    if (!updated) {
      throw new NotFoundError('Contract not found');
    }

    // Both a contract-completion action and a wallet movement — audited per CLAUDE.md (the
    // wallet.hold_capture/wallet.credit audit rows from the calls above cover the money side;
    // this one covers the contract-lifecycle side).
    await this.audit.record({
      actorId: clientAccountId,
      action: 'hiring.contract_completed',
      targetType: 'contract',
      targetId: contract.id,
    });

    return updated;
  }

  // Employer invites a specific talent to a listing without waiting for an application.
  async inviteTalent(
    clientAccountId: string,
    listingId: string,
    creativeAccountId: string,
  ): Promise<InvitationDTO> {
    const listing = await this.listings.findById(listingId);
    if (!listing) {
      throw new NotFoundError('Listing not found');
    }
    if (listing.clientAccountId !== clientAccountId) {
      throw new ForbiddenError('You do not own this listing');
    }
    if (listing.status !== 'open') {
      throw new ConflictError('This listing is no longer open');
    }

    const invitee = await this.accounts.findById(creativeAccountId);
    if (!invitee || invitee.accountType !== 'creative') {
      throw new BadRequestError('Invitations can only be sent to a creative account');
    }

    const existing = await this.invitations.findByListingAndCreative(
      listingId,
      creativeAccountId,
    );
    if (existing) {
      throw new ConflictError('This talent has already been invited to this listing');
    }

    return this.invitations.create({ listingId, clientAccountId, creativeAccountId });
  }

  async listMyInvitations(
    creativeAccountId: string,
    params: PageParams,
  ): Promise<InvitationPage> {
    return this.invitations.listByCreative(creativeAccountId, params);
  }

  async declineInvitation(
    creativeAccountId: string,
    invitationId: string,
  ): Promise<InvitationDTO> {
    const invitation = await this.invitations.findById(invitationId);
    if (!invitation) {
      throw new NotFoundError('Invitation not found');
    }
    if (invitation.creativeAccountId !== creativeAccountId) {
      throw new ForbiddenError('You do not own this invitation');
    }
    if (invitation.status !== 'pending') {
      throw new ConflictError('This invitation has already been responded to');
    }

    const updated = await this.invitations.updateStatus(invitationId, 'declined');
    if (!updated) {
      throw new NotFoundError('Invitation not found');
    }
    return updated;
  }

  // Talent-owner only. Creates the application (status 'accepted' directly, skipping the usual
  // pending -> accepted client review) and funds/creates the contract in the SAME code path
  // updateApplicationStatus's accepted branch uses — see persistContractWithEscrow.
  async acceptInvitation(
    creativeAccountId: string,
    invitationId: string,
  ): Promise<ApplicationDTO> {
    const invitation = await this.invitations.findById(invitationId);
    if (!invitation) {
      throw new NotFoundError('Invitation not found');
    }
    if (invitation.creativeAccountId !== creativeAccountId) {
      throw new ForbiddenError('You do not own this invitation');
    }
    if (invitation.status !== 'pending') {
      throw new ConflictError('This invitation has already been responded to');
    }

    const listing = await this.listings.findById(invitation.listingId);
    if (!listing) {
      throw new NotFoundError('Listing not found');
    }
    if (listing.status !== 'open') {
      throw new ConflictError('This listing is no longer open');
    }

    const existingApplication = await this.applications.findByListingAndCreative(
      invitation.listingId,
      creativeAccountId,
    );
    if (existingApplication) {
      throw new ConflictError('You have already applied to this listing');
    }

    // The application id has to be known before it's inserted: it's both the escrow hold's
    // idempotency reference and the contract's applicationId, and the application/contract
    // insert happens together in one transaction below.
    const applicationId = this.applications.generateId();

    let createdApplication: ApplicationDTO | undefined;
    await this.persistContractWithEscrow(
      creativeAccountId,
      listing,
      applicationId,
      creativeAccountId,
      async (session) => {
        createdApplication = await this.applications.create(
          {
            id: applicationId,
            listingId: listing.id,
            clientAccountId: listing.clientAccountId,
            creativeAccountId,
            status: 'accepted',
          },
          session,
        );
        await this.invitations.updateStatus(invitation.id, 'accepted', session);
      },
    );

    this.events.publish<ApplicationEventPayload>('application.created', {
      listingId: listing.id,
      applicationId,
    });

    // Set by the callback above, which persistContractWithEscrow always awaits before returning.
    return createdApplication as ApplicationDTO;
  }

  async getMyStats(
    accountId: string,
  ): Promise<CreativeHiringStatsDTO | ClientHiringStatsDTO> {
    const account = await this.accounts.findById(accountId);
    if (!account) {
      throw new NotFoundError('Account not found');
    }

    if (account.accountType === 'creative') {
      const [activeContracts, pendingApplications] = await Promise.all([
        this.contracts.countActiveForCreative(accountId),
        this.applications.countPendingForCreative(accountId),
      ]);
      return { activeContracts, pendingApplications };
    }

    const applicantsWaiting = await this.applications.countPendingForClient(accountId);
    return { applicantsWaiting };
  }

  // Shared by updateApplicationStatus's accepted branch and acceptInvitation — the ONE place
  // that funds escrow and creates a contract, so both call sites stay behaviorally identical.
  //
  // Order matters for money correctness: the wallet hold happens first (outside any DB
  // transaction — it's a different module's storage), keyed deterministically off applicationId
  // so a retry after a partial failure never double-holds. Only once the hold succeeds does
  // `persistApplication` (whatever the caller needs written alongside the contract — an
  // application status flip, or a brand-new application + invitation status flip) run together
  // with the contract insert inside one Mongo transaction, so hiring's own documents never end
  // up split across a committed write and a lost one.
  private async persistContractWithEscrow(
    actorId: string,
    listing: { id: string; clientAccountId: string; budgetMaxMinor: number; currency: string },
    applicationId: string,
    creativeAccountId: string,
    persistApplication: (session: ClientSession) => Promise<void>,
  ): Promise<ContractDTO> {
    // Hold the upper end of the listing's budget range so escrow always covers the maximum the
    // client could owe, even if the final agreed rate lands above the midpoint.
    const holdKey = `hiring:contract-escrow:${applicationId}`;
    const hold = await this.wallet.hold(listing.clientAccountId, listing.currency, listing.budgetMaxMinor, {
      idempotencyKey: holdKey,
      reference: applicationId,
      description: 'Escrow hold for accepted application',
    });

    const contract = await this.transactions.withTransaction(async (session) => {
      await persistApplication(session);
      return this.contracts.create(
        {
          listingId: listing.id,
          applicationId,
          clientAccountId: listing.clientAccountId,
          creativeAccountId,
          escrowHoldEntryId: hold.id,
        },
        session,
      );
    });

    await this.audit.record({
      actorId,
      action: 'hiring.contract_created',
      targetType: 'contract',
      targetId: contract.id,
    });

    return contract;
  }
}
