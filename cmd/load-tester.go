package main

import (
	"flag"
	"path/filepath"
	"time"

	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/util/homedir"
	metricsv "k8s.io/metrics/pkg/client/clientset/versioned"

	"github.com/kyverno/load-testing/pkg/config"
	"github.com/kyverno/load-testing/pkg/reporter"
	taskpkg "github.com/kyverno/load-testing/pkg/task"
	"github.com/kyverno/load-testing/tests"
)

func main() {
	var kubeConfig *string
	var loadTestConfig config.LoadTestConfig

	if home := homedir.HomeDir(); home != "" {
		kubeConfig = flag.String("kubeconfig", filepath.Join(home, ".kube", "config"), "(optional) absolute path to the kubeconfig file")
	} else {
		kubeConfig = flag.String("kubeconfig", "", "absolute path to the kubeconfig file")
	}
	flag.IntVar(&loadTestConfig.ConcurrentUsers, "concurrent-users", 10, "Number of concurrent virtual users")
	flag.IntVar(&loadTestConfig.TotalRequests, "total-requests", 100, "Total number of requests to perform")
	flag.DurationVar(&loadTestConfig.Timeout, "timeout", 10*time.Second, "Timeout for each request")
	flag.Parse()

	config, err := clientcmd.BuildConfigFromFlags("", *kubeConfig)
	if err != nil {
		panic(err.Error())
	}

	config.QPS = float32(loadTestConfig.TotalRequests)
	config.Burst = loadTestConfig.TotalRequests

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		panic(err.Error())
	}

	metricsClientset, err := metricsv.NewForConfig(config)
	if err != nil {
		panic(err.Error())
	}

	task := tests.CreatePodTask{ClientSet: clientset}
	executer := taskpkg.NewTaskExecuter(&task, loadTestConfig, metricsClientset)
	taskMetrics, resourceMetrics := executer.Execute()

	reporter := reporter.NewReporter(taskMetrics, resourceMetrics)
	reporter.Print()
}
