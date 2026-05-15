package user

type User struct {
	ID        int
	Full_name string
	Email     string
	Password  string
}

type CreateInput struct {
	FullName string
	Email    string
	Password string
}
