package tests

import (
	"context"
	"fmt"
	"time"

	apiv1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/util/retry"

	"github.com/kyverno/load-testing/pkg/task"
)

type CreatePodTask struct {
	ClientSet *kubernetes.Clientset
}

func (t CreatePodTask) Run() task.TaskResult {
	podsClient := t.ClientSet.CoreV1().Pods(apiv1.NamespaceDefault)

	podName := fmt.Sprintf("test-pod-%d", time.Now().UnixNano())

	pod := &apiv1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name: podName,
		},
		Spec: apiv1.PodSpec{
			Containers: []apiv1.Container{
				{
					Name:  "test-container",
					Image: "nginx",
				},
			},
		},
	}

	_, err := podsClient.Create(context.TODO(), pod, metav1.CreateOptions{})
	if err != nil {
		fmt.Printf("Error creating pod: %v\n", err)
		return task.Failure
	}

	retryErr := retry.RetryOnConflict(retry.DefaultRetry, func() error {
		result, getErr := podsClient.Get(context.TODO(), podName, metav1.GetOptions{})
		if getErr != nil {
			fmt.Printf("Failed to get latest version of Deployment: %v", getErr)
			return getErr
		}

		result.Labels = map[string]string{"foo": "bar"}
		_, updateErr := podsClient.Update(context.TODO(), result, metav1.UpdateOptions{})
		return updateErr
	})
	if retryErr != nil {
		fmt.Printf("Update failed: %v", retryErr)
		return task.Failure
	}

	deletePolicy := metav1.DeletePropagationForeground
	if err := podsClient.Delete(context.TODO(), podName, metav1.DeleteOptions{
		PropagationPolicy: &deletePolicy,
	}); err != nil {
		fmt.Printf("Error deleting pod: %v\n", err)
		return task.Failure
	}

	return task.Success
}
