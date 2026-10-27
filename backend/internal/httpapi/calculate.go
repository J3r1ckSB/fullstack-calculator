package httpapi

import (
	"errors"
	"fmt"
	"log/slog"
	"mime"
	"net/http"

	"github.com/J3r1ckSB/fullstack-calculator/backend/internal/calculator"
)

// domainErrors are the calculator failures that are the caller's input, not
// the server's fault.
var domainErrors = []struct {
	err  error
	code string
}{
	{calculator.ErrDivisionByZero, "division_by_zero"},
	{calculator.ErrNegativeSquareRoot, "negative_square_root"},
	{calculator.ErrUndefinedResult, "undefined_result"},
	{calculator.ErrOutOfRange, "result_out_of_range"},
}

func calculate(w http.ResponseWriter, r *http.Request, logger *slog.Logger) {
	name := r.PathValue("operation")
	op, ok := operations[name]
	if !ok {
		writeError(w, http.StatusNotFound, "unknown_operation", fmt.Sprintf("unknown operation %q", name))
		return
	}
	if !hasJSONContentType(r) {
		writeError(w, http.StatusUnsupportedMediaType, "unsupported_media_type", "Content-Type must be application/json")
		return
	}
	in, apiErr := decodeOperands(w, r)
	if apiErr != nil {
		apiErr.write(w, r, logger)
		return
	}
	a, b, apiErr := in.validate(name, op)
	if apiErr != nil {
		apiErr.write(w, r, logger)
		return
	}

	result, err := op.apply(a, b)
	if err != nil {
		domainError(err).write(w, r, logger)
		return
	}
	writeJSON(w, http.StatusOK, resultResponse{Result: result})
}

func hasJSONContentType(r *http.Request) bool {
	mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	return err == nil && mediaType == "application/json"
}

// validate checks that the operands match the operation's arity.
func (in operands) validate(name string, op operation) (a, b float64, err *apiError) {
	switch {
	case in.A == nil:
		return 0, 0, badRequest(`missing operand "a"`)
	case op.arity == 2 && in.B == nil:
		return 0, 0, badRequest(`missing operand "b"`)
	case op.arity == 1 && in.B != nil:
		return 0, 0, badRequest(fmt.Sprintf("operation %q takes only operand \"a\"", name))
	}
	if in.B != nil {
		b = *in.B
	}
	return *in.A, b, nil
}

func domainError(err error) *apiError {
	for _, d := range domainErrors {
		if errors.Is(err, d.err) {
			return &apiError{http.StatusUnprocessableEntity, d.code, err.Error(), nil}
		}
	}
	return internalError(err)
}
