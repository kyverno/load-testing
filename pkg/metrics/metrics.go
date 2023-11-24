package metrics

import "time"

type TaskMetrics struct {
	ElapsedTime time.Duration
}

type ResourceMetrics struct {
	Mem int64
	CPU int64
}

func NewResourceMetrics(mem int64, cpu int64) ResourceMetrics {
	return ResourceMetrics{Mem: mem, CPU: cpu}
}
