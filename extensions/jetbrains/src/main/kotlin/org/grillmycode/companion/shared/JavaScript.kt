package org.grillmycode.companion.shared

import java.math.BigDecimal
import java.math.BigInteger

// JavaScript's numbers
//
// The VS Code extension reads numbers as JavaScript does, and what it writes
// about them is JavaScript's text for them. These give the same answers, so
// both editors read a value the same way and say the same thing about it.

/** A number as JavaScript's String(number) writes it: `1`, not `1.0`; `1e+21`, not `1.0E21`. */
fun jsNumberText(number: Double): String {
    if (number.isNaN()) return "NaN"
    if (number.isInfinite()) return if (number > 0) "Infinity" else "-Infinity"
    if (number == 0.0) return "0"
    // Java writes the same shortest digits; only where the point goes differs.
    val decimal = BigDecimal(java.lang.Double.toString(Math.abs(number))).stripTrailingZeros()
    val digits = decimal.unscaledValue().toString()
    val k = digits.length
    val n = k - decimal.scale()
    val text =
        when {
            n in k..21 -> digits + "0".repeat(n - k)
            n in 1..21 -> digits.substring(0, n) + "." + digits.substring(n)
            n in -5..0 -> "0." + "0".repeat(-n) + digits
            else -> {
                val exponent = n - 1
                val mantissa = if (k == 1) digits else digits[0] + "." + digits.substring(1)
                mantissa + "e" + (if (exponent >= 0) "+" else "-") + Math.abs(exponent)
            }
        }
    return if (number < 0) "-$text" else text
}

private val DECIMAL = Regex("""[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?""")
private val RADIX = Regex("""0([xXoObB])([0-9a-fA-F]+)""")
private val INFINITY = Regex("""[+-]?Infinity""")
private val LEADING_INTEGER = Regex("""^[+-]?\d+""")

/** Whole digits in a radix, as the double JavaScript would hold them. */
internal fun digitsToDouble(
    digits: String,
    radix: Int,
): Double = BigInteger(digits, radix).toDouble()

/** What JavaScript's Number(text) gives for text already trimmed: NaN for anything that is not a number. */
fun jsNumber(text: String): Double {
    if (text.isEmpty()) return 0.0
    if (DECIMAL.matches(text)) return text.toDouble()
    if (INFINITY.matches(text)) return if (text.startsWith("-")) Double.NEGATIVE_INFINITY else Double.POSITIVE_INFINITY
    val radix = RADIX.matchEntire(text) ?: return Double.NaN
    val base =
        when (radix.groupValues[1].lowercase()) {
            "x" -> 16
            "o" -> 8
            else -> 2
        }
    return runCatching { digitsToDouble(radix.groupValues[2], base) }.getOrDefault(Double.NaN)
}

/** What JavaScript's parseInt(text, 10) gives for text already trimmed: its leading whole number, or NaN. */
fun jsParseInt(text: String): Double {
    val match = LEADING_INTEGER.find(text) ?: return Double.NaN
    val value = digitsToDouble(match.value.trimStart('+', '-'), 10)
    return if (match.value.startsWith("-")) -value else value
}
