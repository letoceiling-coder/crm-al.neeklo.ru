import { PaginationQueryDto } from '../dto/pagination.dto';

export function paginate<T>(
  items: T[],
  total: number,
  query: PaginationQueryDto,
) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  return {
    data: items,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export function skipTake(query: PaginationQueryDto) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  return { skip: (page - 1) * limit, take: limit };
}
