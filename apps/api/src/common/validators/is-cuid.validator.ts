import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/** Prisma cuid() — starts with 'c', alphanumeric, typically 25 chars */
const CUID_RE = /^c[a-z0-9]{20,30}$/i;

@ValidatorConstraint({ name: 'isCuid', async: false })
export class IsCuidConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return typeof value === 'string' && CUID_RE.test(value);
  }

  defaultMessage() {
    return 'must be a valid CUID';
  }
}

export function IsCuid(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsCuidConstraint,
    });
  };
}
