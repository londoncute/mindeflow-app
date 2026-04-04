package transport

type UserRespone struct {
	Full_name string `json:"full_name"`
	Email     string `json:"email"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}
