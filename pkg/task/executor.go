package task

import (
	"context"
	"sync/atomic"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	metricsv "k8s.io/metrics/pkg/client/clientset/versioned"

	"github.com/kyverno/load-testing/pkg/config"
	"github.com/kyverno/load-testing/pkg/metrics"
)

func worker(id int, jobs <-chan *Task, results chan<- metrics.TaskMetrics) {
	for task := range jobs {
		startTime := time.Now()
		_ = (*task).Run()
		endTime := time.Now()
		elapsedTime := endTime.Sub(startTime)
		results <- metrics.TaskMetrics{ElapsedTime: elapsedTime}
	}
}

type TaskExecuter struct {
	task          Task
	config        config.LoadTestConfig
	metricsClient *metricsv.Clientset
}

func NewTaskExecuter(task Task, config config.LoadTestConfig, metricsClient *metricsv.Clientset) *TaskExecuter {
	return &TaskExecuter{task: task, config: config, metricsClient: metricsClient}
}

func (t *TaskExecuter) Execute() ([]metrics.TaskMetrics, []metrics.ResourceMetrics) {
	var taskMetrics []metrics.TaskMetrics
	var resourceMetrics []metrics.ResourceMetrics

	numWorkers := t.config.ConcurrentUsers
	numJobs := t.config.TotalRequests

	jobs := make(chan *Task, numJobs)
	results := make(chan metrics.TaskMetrics, numJobs)

	remainingWorkers := int64(numWorkers)

	for i := 1; i <= numWorkers; i++ {
		go func(workerID int) {
			defer atomic.AddInt64(&remainingWorkers, -1)
			worker(workerID, jobs, results)
		}(i)
	}

	go func() {
		for i := 1; i <= numJobs; i++ {
			jobs <- &t.task
		}
		close(jobs)
	}()

	go func() {
		for {
			if atomic.LoadInt64(&remainingWorkers) == 0 {
				close(results)
				break
			}

			resourceMetric, err := t.metricsClient.MetricsV1beta1().PodMetricses("kube-system").Get(context.TODO(), "etcd-kyverno-control-plane", metav1.GetOptions{})
			if err != nil {
				panic(err.Error())
			}
			resultMetrics := metrics.NewResourceMetrics(resourceMetric.Containers[0].Usage.Cpu().MilliValue(), resourceMetric.Containers[0].Usage.Memory().Value())
			resourceMetrics = append(resourceMetrics, resultMetrics)

			time.Sleep(1 * time.Second)
		}
	}()

	for result := range results {
		taskMetrics = append(taskMetrics, result)
	}

	return taskMetrics, resourceMetrics
}
