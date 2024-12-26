export function formatPhoneNumber(phoneNumber: string) {
  const digitsOnly = phoneNumber.replace(/[^\d]/g, "");

  if (digitsOnly.length === 0) {
    return null;
  }

  let formattedNumber: string;

  if (digitsOnly.length === 10) {
    formattedNumber = `+1${digitsOnly}`;
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith("1")) {
    formattedNumber = `+${digitsOnly}`;
  } else if (digitsOnly.length > 11) {
    if (digitsOnly.startsWith("0")) {
      formattedNumber = `+${digitsOnly.substring(1)}`;
    } else {
      formattedNumber = `+${digitsOnly}`;
    }
  } else {
    return null;
  }

  return formattedNumber;
}
