package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// maxBodyBytes bounds memory per request. A valid body is well under 100
// bytes; the rest leaves room for whitespace and long decimal literals.
const maxBodyBytes = 4096

// operands holds pointers so a missing or null operand differs from 0.
type operands struct {
	A *float64 `json:"a"`
	B *float64 `json:"b"`
}

func decodeOperands(w http.ResponseWriter, r *http.Request) (operands, *apiError) {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes))
	dec.DisallowUnknownFields()

	var in operands
	if err := dec.Decode(&in); err != nil {
		return operands{}, classify(err)
	}
	// Decode stops after the first value, so look for anything that follows.
	switch _, err := dec.Token(); {
	case errors.Is(err, io.EOF):
		return in, nil
	case err != nil:
		return operands{}, classify(err)
	default:
		return operands{}, badRequest("request body must contain a single JSON object")
	}
}

// classify maps a decoding error to the API error the client sees.
func classify(err error) *apiError {
	var (
		tooLarge *http.MaxBytesError
		syntax   *json.SyntaxError
		typeErr  *json.UnmarshalTypeError
	)
	switch {
	// First: a body padded with whitespace decodes fine and only fails when
	// the reader is asked for more.
	case errors.As(err, &tooLarge):
		return &apiError{
			http.StatusRequestEntityTooLarge,
			"request_too_large",
			fmt.Sprintf("request body exceeds %d bytes", maxBodyBytes),
			nil,
		}
	case errors.Is(err, io.EOF):
		return badRequest("request body is empty")
	case errors.As(err, &syntax), errors.Is(err, io.ErrUnexpectedEOF):
		return badRequest("request body is not valid JSON")
	case errors.As(err, &typeErr):
		switch {
		case typeErr.Field == "":
			return badRequest("request body must be a JSON object")
		case strings.HasPrefix(typeErr.Value, "number"):
			return badRequest(fmt.Sprintf("operand %q is outside the representable range", typeErr.Field))
		default:
			return badRequest(fmt.Sprintf("operand %q must be a number", typeErr.Field))
		}
	}
	// encoding/json has no typed error for unknown fields.
	if msg, ok := strings.CutPrefix(err.Error(), "json: unknown field "); ok {
		return badRequest("unknown field " + msg)
	}
	// Anything else is the body reader failing (a reset, the read timeout or
	// broken chunked framing), which encoding/json returns unchanged.
	return &apiError{http.StatusBadRequest, "invalid_request", "request body could not be read", err}
}
