package task

type TaskResult int

const (
	Success TaskResult = iota
	Failure
)

type Task interface {
	Run() TaskResult
}
