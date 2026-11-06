import { isValidPhone } from "./phone";

export interface CustomerInput {
  name: string;
  phone: string;
}

export interface CustomerValidation {
  nameMissing: boolean;
  phoneInvalid: boolean;
  valid: boolean;
}

export function validateCustomer(input: CustomerInput): CustomerValidation {
  const nameMissing = input.name.trim() === "";
  const phoneInvalid = !isValidPhone(input.phone);

  return {
    nameMissing,
    phoneInvalid,
    valid: !nameMissing && !phoneInvalid,
  };
}
