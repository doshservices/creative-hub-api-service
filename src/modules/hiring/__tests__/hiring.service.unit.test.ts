import type { ClientSession } from 'mongodb';
import { describe, expect, it, vi } from 'vitest';
import { ConflictError, ForbiddenError, NotFoundError } from '../../../common/errors.js';
import type { ApplicationDTO, ContractDTO, InvitationDTO } from '../dto.js';
import { HiringService } from '../service.js';
import type {
  AccountReaderPort,
  ApplicationRepositoryPort,
  AuditRecorderPort,
  ContractRepositoryPort,
  EventPublisherPort,
  InvitationRepositoryPort,
  ListingReaderPort,
  TransactionRunnerPort,
  WalletMovementPort,
} from '../service.js';

function buildApplication(overrides: Partial<ApplicationDTO> = {}): ApplicationDTO {
  return {
    id: 'application-1',
    listingId: 'listing-1',
    clientAccountId: 'client-1',
    creativeAccountId: 'creative-1',
    status: 'pending',
    message: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildContract(overrides: Partial<ContractDTO> = {}): ContractDTO {
  return {
    id: 'contract-1',
    listingId: 'listing-1',
    applicationId: 'application-1',
    clientAccountId: 'client-1',
    creativeAccountId: 'creative-1',
    status: 'active',
    escrowHoldEntryId: 'hold-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildInvitation(overrides: Partial<InvitationDTO> = {}): InvitationDTO {
  return {
    id: 'invitation-1',
    listingId: 'listing-1',
    clientAccountId: 'client-1',
    creativeAccountId: 'creative-1',
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildService(overrides: {
  applications?: Partial<ApplicationRepositoryPort>;
  contracts?: Partial<ContractRepositoryPort>;
  invitations?: Partial<InvitationRepositoryPort>;
  listings?: Partial<ListingReaderPort>;
  accounts?: Partial<AccountReaderPort>;
  wallet?: Partial<WalletMovementPort>;
  transactions?: Partial<TransactionRunnerPort>;
  audit?: Partial<AuditRecorderPort>;
  events?: Partial<EventPublisherPort>;
}) {
  const applications: ApplicationRepositoryPort = {
    generateId: vi.fn().mockReturnValue('application-2'),
    create: vi.fn().mockResolvedValue(buildApplication()),
    findById: vi.fn().mockResolvedValue(buildApplication()),
    findByListingAndCreative: vi.fn().mockResolvedValue(null),
    listByCreative: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    listByListing: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    updateStatus: vi.fn().mockResolvedValue(buildApplication({ status: 'accepted' })),
    countPendingForCreative: vi.fn().mockResolvedValue(0),
    countPendingForClient: vi.fn().mockResolvedValue(0),
    ...overrides.applications,
  };
  const contracts: ContractRepositoryPort = {
    create: vi.fn().mockResolvedValue(buildContract()),
    findById: vi.fn().mockResolvedValue(buildContract()),
    updateStatus: vi.fn().mockResolvedValue(buildContract({ status: 'completed' })),
    listForAccount: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    countActiveForCreative: vi.fn().mockResolvedValue(0),
    ...overrides.contracts,
  };
  const invitations: InvitationRepositoryPort = {
    create: vi.fn().mockResolvedValue(buildInvitation()),
    findById: vi.fn().mockResolvedValue(buildInvitation()),
    findByListingAndCreative: vi.fn().mockResolvedValue(null),
    listByCreative: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    updateStatus: vi.fn().mockResolvedValue(buildInvitation({ status: 'accepted' })),
    ...overrides.invitations,
  };
  const listings: ListingReaderPort = {
    findById: vi.fn().mockResolvedValue({
      id: 'listing-1',
      clientAccountId: 'client-1',
      status: 'open',
      budgetMaxMinor: 500_000,
      currency: 'NGN',
    }),
    ...overrides.listings,
  };
  const accounts: AccountReaderPort = {
    findById: vi.fn().mockResolvedValue({ accountType: 'creative' }),
    ...overrides.accounts,
  };
  const wallet: WalletMovementPort = {
    hold: vi.fn().mockResolvedValue({ id: 'hold-1', amountMinor: 500_000, currency: 'NGN' }),
    captureHold: vi.fn().mockResolvedValue({ id: 'capture-1', amountMinor: 500_000, currency: 'NGN' }),
    credit: vi.fn().mockResolvedValue({ id: 'credit-1' }),
    ...overrides.wallet,
  };
  const transactions: TransactionRunnerPort = {
    withTransaction(fn) {
      return fn({} as ClientSession);
    },
    ...overrides.transactions,
  };
  const audit: AuditRecorderPort = {
    record: vi.fn().mockResolvedValue(undefined),
    ...overrides.audit,
  };
  const events: EventPublisherPort = {
    publish: vi.fn(),
    ...overrides.events,
  };

  const service = new HiringService(
    applications,
    contracts,
    invitations,
    listings,
    accounts,
    wallet,
    transactions,
    audit,
    events,
  );
  return {
    service,
    applications,
    contracts,
    invitations,
    listings,
    accounts,
    wallet,
    transactions,
    audit,
    events,
  };
}

describe('HiringService.apply', () => {
  it('creates an application against an open listing and publishes application.created', async () => {
    const { service, applications, events } = buildService({});

    await service.apply('creative-1', { listingId: 'listing-1' });

    expect(applications.create).toHaveBeenCalledWith({
      listingId: 'listing-1',
      clientAccountId: 'client-1',
      creativeAccountId: 'creative-1',
    });
    expect(events.publish).toHaveBeenCalledWith('application.created', {
      listingId: 'listing-1',
      applicationId: 'application-1',
    });
  });

  it('rejects when the listing does not exist', async () => {
    const { service } = buildService({ listings: { findById: vi.fn().mockResolvedValue(null) } });

    await expect(service.apply('creative-1', { listingId: 'missing' })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('rejects when the listing is closed', async () => {
    const { service } = buildService({
      listings: {
        findById: vi.fn().mockResolvedValue({
          id: 'listing-1',
          clientAccountId: 'client-1',
          status: 'closed',
          budgetMaxMinor: 500_000,
          currency: 'NGN',
        }),
      },
    });

    await expect(service.apply('creative-1', { listingId: 'listing-1' })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it('rejects a duplicate application to the same listing', async () => {
    const { service } = buildService({
      applications: { findByListingAndCreative: vi.fn().mockResolvedValue(buildApplication()) },
    });

    await expect(service.apply('creative-1', { listingId: 'listing-1' })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });
});

describe('HiringService.listApplicationsForListing', () => {
  it('rejects a client who does not own the listing', async () => {
    const { service } = buildService({
      listings: {
        findById: vi.fn().mockResolvedValue({
          id: 'listing-1',
          clientAccountId: 'someone-else',
          status: 'open',
          budgetMaxMinor: 500_000,
          currency: 'NGN',
        }),
      },
    });

    await expect(
      service.listApplicationsForListing('client-1', 'listing-1', { limit: 20 }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('HiringService.updateApplicationStatus', () => {
  it('rejects a client who does not own the application', async () => {
    const { service } = buildService({
      applications: {
        findById: vi.fn().mockResolvedValue(buildApplication({ clientAccountId: 'someone-else' })),
      },
    });

    await expect(
      service.updateApplicationStatus('client-1', 'application-1', 'accepted'),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('rejects updating an application that already reached a final decision', async () => {
    const { service } = buildService({
      applications: {
        findById: vi.fn().mockResolvedValue(buildApplication({ status: 'accepted' })),
      },
    });

    await expect(
      service.updateApplicationStatus('client-1', 'application-1', 'rejected'),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('holds escrow, creates a contract, and records an audit entry when accepted', async () => {
    const { service, wallet, contracts, audit } = buildService({});

    await service.updateApplicationStatus('client-1', 'application-1', 'accepted');

    expect(wallet.hold).toHaveBeenCalledWith('client-1', 'NGN', 500_000, {
      idempotencyKey: 'hiring:contract-escrow:application-1',
      reference: 'application-1',
      description: 'Escrow hold for accepted application',
    });
    expect(contracts.create).toHaveBeenCalledWith(
      {
        listingId: 'listing-1',
        applicationId: 'application-1',
        clientAccountId: 'client-1',
        creativeAccountId: 'creative-1',
        escrowHoldEntryId: 'hold-1',
      },
      expect.anything(),
    );
    expect(audit.record).toHaveBeenCalledWith({
      actorId: 'client-1',
      action: 'hiring.contract_created',
      targetType: 'contract',
      targetId: 'contract-1',
    });
  });

  it('does not hold escrow or create a contract when the status is not accepted', async () => {
    const { service, contracts, wallet, audit } = buildService({
      applications: {
        updateStatus: vi.fn().mockResolvedValue(buildApplication({ status: 'interview_requested' })),
      },
    });

    await service.updateApplicationStatus('client-1', 'application-1', 'interview_requested');

    expect(wallet.hold).not.toHaveBeenCalled();
    expect(contracts.create).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('never flips the application to accepted when the escrow hold fails', async () => {
    const { service, applications } = buildService({
      wallet: { hold: vi.fn().mockRejectedValue(new ConflictError('Insufficient available balance')) },
    });

    await expect(
      service.updateApplicationStatus('client-1', 'application-1', 'accepted'),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(applications.updateStatus).not.toHaveBeenCalled();
  });
});

describe('HiringService.withdrawApplication', () => {
  it('rejects a creative who does not own the application', async () => {
    const { service } = buildService({
      applications: {
        findById: vi.fn().mockResolvedValue(buildApplication({ creativeAccountId: 'someone-else' })),
      },
    });

    await expect(
      service.withdrawApplication('creative-1', 'application-1'),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('rejects withdrawing an application that already reached a final decision', async () => {
    const { service } = buildService({
      applications: { findById: vi.fn().mockResolvedValue(buildApplication({ status: 'accepted' })) },
    });

    await expect(
      service.withdrawApplication('creative-1', 'application-1'),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('withdraws a pending application and publishes application.withdrawn', async () => {
    const { service, applications, events } = buildService({
      applications: {
        updateStatus: vi.fn().mockResolvedValue(buildApplication({ status: 'withdrawn' })),
      },
    });

    const result = await service.withdrawApplication('creative-1', 'application-1');

    expect(result.status).toBe('withdrawn');
    expect(applications.updateStatus).toHaveBeenCalledWith('application-1', 'withdrawn');
    expect(events.publish).toHaveBeenCalledWith('application.withdrawn', {
      listingId: 'listing-1',
      applicationId: 'application-1',
    });
  });
});

describe('HiringService.completeContract', () => {
  it('rejects a client who does not own the contract', async () => {
    const { service } = buildService({
      contracts: { findById: vi.fn().mockResolvedValue(buildContract({ clientAccountId: 'someone-else' })) },
    });

    await expect(service.completeContract('client-1', 'contract-1')).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('rejects completing a contract that is not active', async () => {
    const { service } = buildService({
      contracts: { findById: vi.fn().mockResolvedValue(buildContract({ status: 'completed' })) },
    });

    await expect(service.completeContract('client-1', 'contract-1')).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it('captures the escrow hold and credits the creative for the captured amount', async () => {
    const { service, wallet, contracts, audit } = buildService({});

    await service.completeContract('client-1', 'contract-1');

    expect(wallet.captureHold).toHaveBeenCalledWith('hold-1', {
      idempotencyKey: 'hiring:contract-capture:contract-1',
      reference: 'contract-1',
      description: 'Escrow capture on contract completion',
    });
    expect(wallet.credit).toHaveBeenCalledWith('creative-1', 'NGN', 500_000, {
      idempotencyKey: 'hiring:contract-payout:contract-1',
      reference: 'contract-1',
      description: 'Contract payout',
    });
    expect(contracts.updateStatus).toHaveBeenCalledWith('contract-1', 'completed');
    expect(audit.record).toHaveBeenCalledWith({
      actorId: 'client-1',
      action: 'hiring.contract_completed',
      targetType: 'contract',
      targetId: 'contract-1',
    });
  });
});

describe('HiringService.inviteTalent', () => {
  it('rejects a client who does not own the listing', async () => {
    const { service } = buildService({
      listings: {
        findById: vi.fn().mockResolvedValue({
          id: 'listing-1',
          clientAccountId: 'someone-else',
          status: 'open',
          budgetMaxMinor: 500_000,
          currency: 'NGN',
        }),
      },
    });

    await expect(
      service.inviteTalent('client-1', 'listing-1', 'creative-1'),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('rejects inviting an account that is not a creative', async () => {
    const { service } = buildService({
      accounts: { findById: vi.fn().mockResolvedValue({ accountType: 'client' }) },
    });

    await expect(service.inviteTalent('client-1', 'listing-1', 'creative-1')).rejects.toThrow();
  });

  it('creates an invitation', async () => {
    const { service, invitations } = buildService({});

    await service.inviteTalent('client-1', 'listing-1', 'creative-1');

    expect(invitations.create).toHaveBeenCalledWith({
      listingId: 'listing-1',
      clientAccountId: 'client-1',
      creativeAccountId: 'creative-1',
    });
  });
});

describe('HiringService.acceptInvitation', () => {
  it('rejects a creative who does not own the invitation', async () => {
    const { service } = buildService({
      invitations: {
        findById: vi.fn().mockResolvedValue(buildInvitation({ creativeAccountId: 'someone-else' })),
      },
    });

    await expect(service.acceptInvitation('creative-1', 'invitation-1')).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('creates an accepted application and funds escrow', async () => {
    const { service, applications, invitations, wallet, contracts, events } = buildService({
      applications: {
        create: vi.fn().mockResolvedValue(buildApplication({ id: 'application-2', status: 'accepted' })),
      },
    });

    const result = await service.acceptInvitation('creative-1', 'invitation-1');

    expect(result.status).toBe('accepted');
    expect(applications.create).toHaveBeenCalledWith(
      {
        id: 'application-2',
        listingId: 'listing-1',
        clientAccountId: 'client-1',
        creativeAccountId: 'creative-1',
        status: 'accepted',
      },
      expect.anything(),
    );
    expect(invitations.updateStatus).toHaveBeenCalledWith('invitation-1', 'accepted', expect.anything());
    expect(wallet.hold).toHaveBeenCalled();
    expect(contracts.create).toHaveBeenCalled();
    expect(events.publish).toHaveBeenCalledWith('application.created', {
      listingId: 'listing-1',
      applicationId: 'application-2',
    });
  });
});

describe('HiringService.getMyStats', () => {
  it("returns a creative's active contracts and pending applications", async () => {
    const { service } = buildService({
      accounts: { findById: vi.fn().mockResolvedValue({ accountType: 'creative' }) },
      contracts: { countActiveForCreative: vi.fn().mockResolvedValue(2) },
      applications: {
        countPendingForCreative: vi.fn().mockResolvedValue(3),
        countPendingForClient: vi.fn().mockResolvedValue(0),
      },
    });

    const stats = await service.getMyStats('creative-1');

    expect(stats).toEqual({ activeContracts: 2, pendingApplications: 3 });
  });

  it("returns a client's applicants waiting", async () => {
    const { service } = buildService({
      accounts: { findById: vi.fn().mockResolvedValue({ accountType: 'client' }) },
      applications: { countPendingForClient: vi.fn().mockResolvedValue(5) },
    });

    const stats = await service.getMyStats('client-1');

    expect(stats).toEqual({ applicantsWaiting: 5 });
  });
});
