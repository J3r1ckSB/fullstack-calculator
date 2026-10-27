// Package calculator implements the arithmetic operations behind the API.
//
// All operations use IEEE-754 float64 and return the exact result; rounding
// for display is the caller's concern. Results that are not finite numbers
// are reported as errors instead of leaking NaN or Inf to callers.
package calculator

import (
	"errors"
	"math"
)

var (
	ErrDivisionByZero     = errors.New("division by zero is undefined")
	ErrNegativeSquareRoot = errors.New("square root of a negative number is not a real number")
	ErrUndefinedResult    = errors.New("result is not a real number")
	ErrOutOfRange         = errors.New("result is outside the representable range")
)

func Add(a, b float64) (float64, error) {
	return check(a + b)
}

func Subtract(a, b float64) (float64, error) {
	return check(a - b)
}

func Multiply(a, b float64) (float64, error) {
	return check(a * b)
}

func Divide(a, b float64) (float64, error) {
	if b == 0 {
		return 0, ErrDivisionByZero
	}
	return check(a / b)
}

func Power(a, b float64) (float64, error) {
	if a == 0 && b < 0 {
		return 0, ErrDivisionByZero
	}
	return check(math.Pow(a, b))
}

// Percentage returns a percent of b. Multiplying before dividing keeps whole
// percentages exact (7% of 3 is 0.21); dividing first is only the fallback
// for products that overflow.
func Percentage(a, b float64) (float64, error) {
	r := a * b / 100
	if math.IsInf(r, 0) {
		r = a / 100 * b
	}
	return check(r)
}

func Sqrt(a float64) (float64, error) {
	if a < 0 {
		return 0, ErrNegativeSquareRoot
	}
	return check(math.Sqrt(a))
}

// check rejects non-finite results and normalizes negative zero to zero.
func check(r float64) (float64, error) {
	switch {
	case math.IsNaN(r):
		return 0, ErrUndefinedResult
	case math.IsInf(r, 0):
		return 0, ErrOutOfRange
	case r == 0:
		return 0, nil
	}
	return r, nil
}
