export interface ReviewDTO {
  id: string;
  contractId: string;
  reviewerAccountId: string;
  revieweeAccountId: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
}

export interface ReviewPage {
  items: ReviewDTO[];
  nextCursor: string | null;
}

export interface RatingAggregate {
  ratingSum: number;
  ratingCount: number;
}
