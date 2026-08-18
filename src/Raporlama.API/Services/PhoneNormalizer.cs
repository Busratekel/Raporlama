namespace Raporlama.API.Services;

public static class PhoneNormalizer
{
    public static string Normalize(string phone)
    {
        var digits = new string(phone.Where(char.IsDigit).ToArray());
        if (digits.StartsWith("90") && digits.Length == 12)
            return digits;
        if (digits.StartsWith("0") && digits.Length == 11)
            return "9" + digits;
        if (digits.Length == 10)
            return "90" + digits;
        return digits;
    }

    public static bool TryNormalizeForStorage(string? input, out string? normalized, out string? error)
    {
        if (string.IsNullOrWhiteSpace(input))
        {
            normalized = null;
            error = null;
            return true;
        }

        normalized = Normalize(input.Trim());
        if (normalized.Length != 12 || !normalized.StartsWith("90"))
        {
            normalized = null;
            error = "Geçerli bir cep telefonu girin (ör. 05xx xxx xx xx veya 905xx...).";
            return false;
        }

        error = null;
        return true;
    }

    public static string FormatForDisplay(string? stored)
    {
        if (string.IsNullOrWhiteSpace(stored))
            return "";

        var digits = new string(stored.Where(char.IsDigit).ToArray());
        if (digits.StartsWith("90") && digits.Length == 12)
            return "0" + digits[2..];
        return stored;
    }
}
