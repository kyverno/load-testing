package reporter

import (
	"fmt"
	"sort"
	"time"

	"github.com/kyverno/load-testing/pkg/metrics"
)

type Reporter struct {
	taskMetrics     []metrics.TaskMetrics
	resourceMetrics []metrics.ResourceMetrics
}

func NewReporter(taskMetrics []metrics.TaskMetrics, resourceMetrics []metrics.ResourceMetrics) *Reporter {
	return &Reporter{taskMetrics: taskMetrics, resourceMetrics: resourceMetrics}
}

func (r *Reporter) Print() {
	r.printTaskMetrics()
	r.printResourceMetrics()
}

func (r *Reporter) printTaskMetrics() {
	var totalElapsedTime time.Duration
	var taskDurations []time.Duration

	for _, taskMetric := range r.taskMetrics {
		totalElapsedTime += taskMetric.ElapsedTime
		taskDurations = append(taskDurations, taskMetric.ElapsedTime)
	}

	sort.Slice(taskDurations, func(i, j int) bool {
		return taskDurations[i] < taskDurations[j]
	})

	fmt.Println("Task Metrics")
	fmt.Println("============")
	fmt.Printf("Total Elapsed Time: %v\n", totalElapsedTime)
	fmt.Printf("Median Task Duration: %v\n", taskDurations[len(taskDurations)/2])
	fmt.Printf("Average Task Duration: %v\n", totalElapsedTime/time.Duration(len(r.taskMetrics)))
	fmt.Printf("Minimum Task Duration: %v\n", taskDurations[0])
	fmt.Printf("Maximum Task Duration: %v\n", taskDurations[len(taskDurations)-1])
	fmt.Printf("p90 Task Duration: %v\n", taskDurations[int(float64(len(taskDurations))*0.9)])
	fmt.Printf("p95 Task Duration: %v\n", taskDurations[int(float64(len(taskDurations))*0.95)])
	fmt.Printf("p99 Task Duration: %v\n", taskDurations[int(float64(len(taskDurations))*0.99)])
	fmt.Println()
}

func (r *Reporter) printResourceMetrics() {
	var totalMem int64
	var totalCPU int64
	var mems []int64
	var cpus []int64

	for _, resourceMetric := range r.resourceMetrics {
		totalMem += resourceMetric.Mem
		totalCPU += resourceMetric.CPU
		mems = append(mems, resourceMetric.Mem)
		cpus = append(cpus, resourceMetric.CPU)
	}

	sort.Slice(mems, func(i, j int) bool {
		return mems[i] < mems[j]
	})

	sort.Slice(cpus, func(i, j int) bool {
		return cpus[i] < cpus[j]
	})

	fmt.Println("Resource Metrics")
	fmt.Println("================")
	fmt.Printf("Total Memory: %v\n", totalMem)
	fmt.Printf("Median Memory: %v\n", mems[len(mems)/2])
	fmt.Printf("Average Memory: %v\n", totalMem/int64(len(r.resourceMetrics)))
	fmt.Printf("Minimum Memory: %v\n", mems[0])
	fmt.Printf("Maximum Memory: %v\n", mems[len(mems)-1])
	fmt.Printf("p90 Memory: %v\n", mems[int(float64(len(mems))*0.9)])
	fmt.Printf("p95 Memory: %v\n", mems[int(float64(len(mems))*0.95)])
	fmt.Printf("p99 Memory: %v\n", mems[int(float64(len(mems))*0.99)])
	fmt.Println()
	fmt.Printf("Total CPU: %v\n", totalCPU)
	fmt.Printf("Median CPU: %v\n", cpus[len(cpus)/2])
	fmt.Printf("Average CPU: %v\n", totalCPU/int64(len(r.resourceMetrics)))
	fmt.Printf("Minimum CPU: %v\n", cpus[0])
	fmt.Printf("Maximum CPU: %v\n", cpus[len(cpus)-1])
	fmt.Printf("p90 CPU: %v\n", cpus[int(float64(len(cpus))*0.9)])
	fmt.Printf("p95 CPU: %v\n", cpus[int(float64(len(cpus))*0.95)])
	fmt.Printf("p99 CPU: %v\n", cpus[int(float64(len(cpus))*0.99)])
	fmt.Println()
}
