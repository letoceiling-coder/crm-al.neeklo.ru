import { HttpException, HttpStatus } from '@nestjs/common';

export type ApiErrorBody = {
  statusCode: number;
  error: string;
  code: string;
  message: string;
  [key: string]: unknown;
};

export function apiHttpException(
  status: HttpStatus,
  code: string,
  message: string,
  error: string,
  extra?: Record<string, unknown>,
): never {
  throw new HttpException(
    {
      statusCode: status,
      error,
      code,
      message,
      ...extra,
    } satisfies ApiErrorBody,
    status,
  );
}
