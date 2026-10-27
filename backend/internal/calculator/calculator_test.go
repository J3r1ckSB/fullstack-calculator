package calculator

import (
	"errors"
	"math"
	"testing"
)

// Operands are table fields, not constant expressions: Go folds untyped
// constants exactly, so 0.1 + 0.2 written inline would equal 0.3.
type binaryCase struct {
	name    string
	a, b    float64
	want    float64
	wantErr error
}

type unaryCase struct {
	name    string
	a       float64
	want    float64
	wantErr error
}

var negZero = math.Copysign(0, -1)

func runBinary(t *testing.T, fn func(a, b float64) (float64, error), cases []binaryCase) {
	t.Helper()
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := fn(tc.a, tc.b)
			assertResult(t, got, err, tc.want, tc.wantErr)
		})
	}
}

func assertResult(t *testing.T, got float64, err error, want float64, wantErr error) {
	t.Helper()
	if !errors.Is(err, wantErr) {
		t.Fatalf("error = %v, want %v", err, wantErr)
	}
	if got != want {
		t.Errorf("result = %v, want %v", got, want)
	}
	if got == 0 && math.Signbit(got) {
		t.Error("result is negative zero")
	}
}

func TestAdd(t *testing.T) {
	runBinary(t, Add, []binaryCase{
		{name: "integers", a: 2, b: 3, want: 5},
		{name: "float64 is not rounded", a: 0.1, b: 0.2, want: 0.30000000000000004},
		{name: "negative operands", a: -2, b: -3, want: -5},
		{name: "negative zero is normalized", a: negZero, b: negZero, want: 0},
		{name: "overflow", a: math.MaxFloat64, b: math.MaxFloat64, wantErr: ErrOutOfRange},
	})
}

func TestSubtract(t *testing.T) {
	runBinary(t, Subtract, []binaryCase{
		{name: "integers", a: 10, b: 4, want: 6},
		{name: "negative result", a: 4, b: 10, want: -6},
		{name: "equal operands", a: 5, b: 5, want: 0},
		{name: "overflow", a: -math.MaxFloat64, b: math.MaxFloat64, wantErr: ErrOutOfRange},
	})
}

func TestMultiply(t *testing.T) {
	runBinary(t, Multiply, []binaryCase{
		{name: "decimal", a: 2.5, b: 4, want: 10},
		{name: "negative zero is normalized", a: 0, b: -5, want: 0},
		{name: "overflow", a: 1e308, b: 10, wantErr: ErrOutOfRange},
	})
}

func TestDivide(t *testing.T) {
	runBinary(t, Divide, []binaryCase{
		{name: "fraction", a: 1, b: 4, want: 0.25},
		{name: "negative result", a: -9, b: 3, want: -3},
		{name: "zero numerator", a: 0, b: 5, want: 0},
		{name: "by zero", a: 1, b: 0, wantErr: ErrDivisionByZero},
		{name: "zero by zero", a: 0, b: 0, wantErr: ErrDivisionByZero},
		{name: "by negative zero", a: 1, b: negZero, wantErr: ErrDivisionByZero},
		{name: "overflow", a: 1e308, b: 1e-10, wantErr: ErrOutOfRange},
	})
}

func TestPower(t *testing.T) {
	runBinary(t, Power, []binaryCase{
		{name: "integer exponent", a: 2, b: 10, want: 1024},
		{name: "negative exponent", a: 2, b: -1, want: 0.5},
		{name: "zero to the zero", a: 0, b: 0, want: 1},
		{name: "negative base, odd exponent", a: -8, b: 3, want: -512},
		{name: "zero to a negative exponent", a: 0, b: -1, wantErr: ErrDivisionByZero},
		{name: "negative base, fractional exponent", a: -8, b: 1.0 / 3, wantErr: ErrUndefinedResult},
		{name: "overflow", a: 10, b: 400, wantErr: ErrOutOfRange},
	})
}

func TestPercentage(t *testing.T) {
	runBinary(t, Percentage, []binaryCase{
		{name: "whole percentage", a: 15, b: 80, want: 12},
		{name: "multiplies before dividing", a: 7, b: 3, want: 0.21},
		{name: "negative percentage", a: -50, b: 80, want: -40},
		{name: "intermediate product overflows", a: 1e308, b: 10, want: 1e307},
		{name: "result overflows", a: 1e308, b: 1e308, wantErr: ErrOutOfRange},
	})
}

func TestSqrt(t *testing.T) {
	cases := []unaryCase{
		{name: "perfect square", a: 16, want: 4},
		{name: "irrational", a: 2, want: 1.4142135623730951},
		{name: "zero", a: 0, want: 0},
		{name: "negative zero", a: negZero, want: 0},
		{name: "negative number", a: -9, wantErr: ErrNegativeSquareRoot},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := Sqrt(tc.a)
			assertResult(t, got, err, tc.want, tc.wantErr)
		})
	}
}
