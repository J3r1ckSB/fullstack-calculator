package httpapi

import "github.com/J3r1ckSB/fullstack-calculator/backend/internal/calculator"

// operation adapts a calculator function to the shared request flow. Unary
// operations ignore the second operand.
type operation struct {
	arity int
	apply func(a, b float64) (float64, error)
}

var operations = map[string]operation{
	"add":        binary(calculator.Add),
	"subtract":   binary(calculator.Subtract),
	"multiply":   binary(calculator.Multiply),
	"divide":     binary(calculator.Divide),
	"power":      binary(calculator.Power),
	"percentage": binary(calculator.Percentage),
	"sqrt":       unary(calculator.Sqrt),
}

func binary(fn func(a, b float64) (float64, error)) operation {
	return operation{arity: 2, apply: fn}
}

func unary(fn func(a float64) (float64, error)) operation {
	return operation{
		arity: 1,
		apply: func(a, _ float64) (float64, error) { return fn(a) },
	}
}
