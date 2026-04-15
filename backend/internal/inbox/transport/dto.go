package transport

type CreateRequest struct {
	Title string `json:"title"`
	Text  string `json:"text"`
}

type InboxItemResponse struct {
	ID       int    `json:"id"`
	Title    string `json:"title"`
	Text     string `json:"text"`
	Status   string `json:"status"`
	Position int    `json:"position"`
}

type ListResponse struct {
	Data []InboxItemResponse `json:"data"`
	Meta MetaResponse        `json:"meta"`
}

type MetaResponse struct {
	Limit  int `json:"limit"`
	Offset int `json:"offset"`
	Total  int `json:"total"`
}

type SkipResponse struct {
	ID     int    `json:"id"`
	Status string `json:"status"`
}
