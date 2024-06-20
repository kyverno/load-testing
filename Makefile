.DEFAULT_GOAL: build-all

############
# DEFAULTS #
############

GIT_SHA              := $(shell git rev-parse HEAD)
KIND_IMAGE           ?= kindest/node:v1.28.0
KIND_NAME            ?= kind
KIND_CONFIG          ?= default
USE_CONFIG           ?= standard

#########
# TOOLS #
#########

TOOLS_DIR                          := $(PWD)/.tools
KIND                               := $(TOOLS_DIR)/kind
KIND_VERSION                       := v0.20.0
HELM                               := $(TOOLS_DIR)/helm
HELM_VERSION                       := v3.12.3
XK6                                := $(TOOLS_DIR)/xk6
XK6_VERSION                        := v0.9.0
K6                                 := $(TOOLS_DIR)/k6
K6_VERSION                         := v0.47.0
XK6_KUBERNETES_VERSION             := v0.8.0
TOOLS                              := $(KIND) $(HELM) $(XK6) $(K6)
COMMA                              := ,

$(KIND):
	@echo Install kind... >&2
	@GOBIN=$(TOOLS_DIR) go install sigs.k8s.io/kind@$(KIND_VERSION)

$(HELM):
	@echo Install helm... >&2
	@GOBIN=$(TOOLS_DIR) go install helm.sh/helm/v3/cmd/helm@$(HELM_VERSION)

$(XK6):
	@echo Install xk6... >&2
	@GOBIN=$(TOOLS_DIR) go install go.k6.io/xk6/cmd/xk6@$(XK6_VERSION)

$(K6):
	@echo Install k6... >&2
	$(XK6) build $(K6_VERSION) --output $(K6) --with github.com/grafana/xk6-kubernetes@$(XK6_KUBERNETES_VERSION)

.PHONY: install-tools
install-tools: $(TOOLS) ## Install tools

.PHONY: clean-tools
clean-tools: ## Remove installed tools
	@echo Clean tools... >&2
	@rm -rf $(TOOLS_DIR)

#############
# HELM TEST #
#############

.PHONY: helm-test
helm-test: $(HELM) ## Run helm test
	@echo Running helm test... >&2
	@$(HELM) test --namespace kyverno kyverno

#############
# PERF TEST #
#############

GOPATH_SHIM                 := ${PWD}/.gopath
PACKAGE_SHIM                := $(GOPATH_SHIM)/src/$(PACKAGE)

$(GOPATH_SHIM):
	@echo Create gopath shim... >&2
	@mkdir -p $(GOPATH_SHIM)

.INTERMEDIATE: $(PACKAGE_SHIM)
$(PACKAGE_SHIM): $(GOPATH_SHIM)
	@echo Create package shim... >&2
	@mkdir -p $(GOPATH_SHIM)/src/github.com/kyverno && ln -s -f ${PWD} $(PACKAGE_SHIM)

PERF_TEST_NODE_COUNT		?= 3
PERF_TEST_MEMORY_REQUEST	?= "1Gi"

.PHONY: test-perf
test-perf: $(PACKAGE_SHIM) ## Run perf tests
	GO111MODULE=off GOPATH=$(GOPATH_SHIM) go get k8s.io/perf-tests || true
	cd $(GOPATH_SHIM)/src/k8s.io/perf-tests && \
	GOPATH=$(GOPATH_SHIM) ./run-e2e.sh cluster-loader2 \
		--testconfig=./testing/load/config.yaml \
		--provider=kind \
		--kubeconfig=${HOME}/.kube/config \
		--nodes=$(PERF_TEST_NODE_COUNT) \
		--prometheus-memory-request=$(PERF_TEST_MEMORY_REQUEST) \
		--enable-prometheus-server=true \
		--tear-down-prometheus-server=true \
		--prometheus-apiserver-scrape-port=6443 \
		--prometheus-scrape-kubelets=true \
		--prometheus-scrape-master-kubelets=true \
		--prometheus-scrape-etcd=true \
		--prometheus-scrape-kube-proxy=true \
		--prometheus-kube-proxy-selector-key=k8s-app \
		--prometheus-scrape-node-exporter=false \
		--prometheus-scrape-kube-state-metrics=true \
		--prometheus-scrape-metrics-server=true \
		--prometheus-pvc-storage-class=standard \
		--v=2 \
		--report-dir=.

########
# KIND #
########

.PHONY: kind-create-cluster
kind-create-cluster: $(KIND) ## Create kind cluster
	@echo Create kind cluster... >&2
	@$(KIND) create cluster --name $(KIND_NAME) --image $(KIND_IMAGE) --config ./scripts/config/kind/$(KIND_CONFIG).yaml

.PHONY: kind-delete-cluster
kind-delete-cluster: $(KIND) ## Delete kind cluster
	@echo Delete kind cluster... >&2
	@$(KIND) delete cluster --name $(KIND_NAME)

.PHONY: kind-load-kyverno-init
kind-load-kyverno-init: $(KIND) image-build-kyverno-init ## Build kyvernopre image and load it in kind cluster
	@echo Load kyvernopre image... >&2
	@$(KIND) load docker-image --name $(KIND_NAME) $(LOCAL_REGISTRY)/$(LOCAL_KYVERNOPRE_REPO):$(GIT_SHA)

.PHONY: kind-load-kyverno
kind-load-kyverno: $(KIND) image-build-kyverno ## Build kyverno image and load it in kind cluster
	@echo Load kyverno image... >&2
	@$(KIND) load docker-image --name $(KIND_NAME) $(LOCAL_REGISTRY)/$(LOCAL_KYVERNO_REPO):$(GIT_SHA)

.PHONY: kind-load-cleanup-controller
kind-load-cleanup-controller: $(KIND) image-build-cleanup-controller ## Build cleanup controller image and load it in kind cluster
	@echo Load cleanup controller image... >&2
	@$(KIND) load docker-image --name $(KIND_NAME) $(LOCAL_REGISTRY)/$(LOCAL_CLEANUP_REPO):$(GIT_SHA)

.PHONY: kind-load-reports-controller
kind-load-reports-controller: $(KIND) image-build-reports-controller ## Build reports controller image and load it in kind cluster
	@echo Load reports controller image... >&2
	@$(KIND) load docker-image --name $(KIND_NAME) $(LOCAL_REGISTRY)/$(LOCAL_REPORTS_REPO):$(GIT_SHA)

.PHONY: kind-load-background-controller
kind-load-background-controller: $(KIND) image-build-background-controller ## Build background controller image and load it in kind cluster
	@echo Load background controller image... >&2
	@$(KIND) load docker-image --name $(KIND_NAME) $(LOCAL_REGISTRY)/$(LOCAL_BACKGROUND_REPO):$(GIT_SHA)

.PHONY: kind-load-all
kind-load-all: kind-load-kyverno-init kind-load-kyverno kind-load-cleanup-controller kind-load-reports-controller kind-load-background-controller ## Build images and load them in kind cluster

.PHONY: kind-load-image-archive
kind-load-image-archive: $(KIND) ## Load docker images from archive
	@echo Load image archive in kind cluster... >&2
	@$(KIND) load image-archive kyverno.tar --name $(KIND_NAME)

.PHONY: kind-install-kyverno
kind-install-kyverno: $(HELM) ## Install kyverno helm chart
	@echo Install kyverno chart... >&2
	@$(HELM) upgrade --install kyverno --namespace kyverno --create-namespace --wait ./charts/kyverno \
		--set admissionController.container.image.registry=$(LOCAL_REGISTRY) \
		--set admissionController.container.image.repository=$(LOCAL_KYVERNO_REPO) \
		--set admissionController.container.image.tag=$(GIT_SHA) \
		--set admissionController.initContainer.image.registry=$(LOCAL_REGISTRY) \
		--set admissionController.initContainer.image.repository=$(LOCAL_KYVERNOPRE_REPO) \
		--set admissionController.initContainer.image.tag=$(GIT_SHA) \
		--set cleanupController.image.registry=$(LOCAL_REGISTRY) \
		--set cleanupController.image.repository=$(LOCAL_CLEANUP_REPO) \
		--set cleanupController.image.tag=$(GIT_SHA) \
		--set reportsController.image.registry=$(LOCAL_REGISTRY) \
		--set reportsController.image.repository=$(LOCAL_REPORTS_REPO) \
		--set reportsController.image.tag=$(GIT_SHA) \
		--set backgroundController.image.registry=$(LOCAL_REGISTRY) \
		--set backgroundController.image.repository=$(LOCAL_BACKGROUND_REPO) \
		--set backgroundController.image.tag=$(GIT_SHA) \
		$(foreach CONFIG,$(subst $(COMMA), ,$(USE_CONFIG)),--values ./scripts/config/$(CONFIG)/kyverno.yaml)

.PHONY: kind-deploy-kyverno
kind-deploy-kyverno: $(HELM) kind-load-all ## Build images, load them in kind cluster and deploy kyverno helm chart
	@$(MAKE) kind-install-kyverno

.PHONY: kind-deploy-kyverno-policies
kind-deploy-kyverno-policies: $(HELM) ## Deploy kyverno-policies helm chart
	@echo Install kyverno-policies chart... >&2
	@$(HELM) upgrade --install kyverno-policies --namespace kyverno --create-namespace --wait ./charts/kyverno-policies \
		$(foreach CONFIG,$(subst $(COMMA), ,$(USE_CONFIG)),--values ./scripts/config/$(CONFIG)/kyverno-policies.yaml)

.PHONY: kind-deploy-all
kind-deploy-all: | kind-deploy-kyverno kind-deploy-kyverno-policies ## Build images, load them in kind cluster and deploy helm charts

.PHONY: kind-deploy-reporter
kind-deploy-reporter: $(HELM) ## Deploy policy-reporter helm chart
	@echo Install policy-reporter chart... >&2
	@$(HELM) upgrade --install policy-reporter --namespace policy-reporter --create-namespace --wait \
		--repo https://kyverno.github.io/policy-reporter policy-reporter \
		--values ./scripts/config/standard/kyverno-reporter.yaml
	@kubectl port-forward -n policy-reporter services/policy-reporter-ui  8082:8080

###########
# DEV LAB #
###########

.PHONY: dev-lab-ingress-ngingx
dev-lab-ingress-ngingx: ## Deploy ingress-ngingx
	@echo Install ingress-ngingx... >&2
	@kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
	@sleep 15
	@kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=90s

.PHONY: dev-lab-prometheus
dev-lab-prometheus: $(HELM) ## Deploy kube-prometheus-stack helm chart
	@echo Install kube-prometheus-stack chart... >&2
	@$(HELM) upgrade --install kube-prometheus-stack --namespace monitoring --create-namespace --wait \
		--repo https://prometheus-community.github.io/helm-charts kube-prometheus-stack \
		--values ./scripts/config/dev/kube-prometheus-stack.yaml

.PHONY: dev-lab-loki
dev-lab-loki: $(HELM) ## Deploy loki-stack helm chart
	@echo Install loki-stack chart... >&2
	@$(HELM) upgrade --install loki-stack --namespace monitoring --create-namespace --wait \
		--repo https://grafana.github.io/helm-charts loki-stack \
		--values ./scripts/config/dev/loki-stack.yaml

.PHONY: dev-lab-tempo
dev-lab-tempo: $(HELM) ## Deploy tempo helm chart
	@echo Install tempo chart... >&2
	@$(HELM) upgrade --install tempo --namespace monitoring --create-namespace --wait \
		--repo https://grafana.github.io/helm-charts tempo \
		--values ./scripts/config/dev/tempo.yaml
	@kubectl apply -f ./scripts/config/dev/tempo-datasource.yaml

.PHONY: dev-lab-otel-collector
dev-lab-otel-collector: $(HELM) ## Deploy tempo helm chart
	@echo Install otel-collector chart... >&2
	@$(HELM) upgrade --install opentelemetry-collector --namespace monitoring --create-namespace --wait \
		--repo https://open-telemetry.github.io/opentelemetry-helm-charts opentelemetry-collector \
		--values ./scripts/config/dev/otel-collector.yaml

.PHONY: dev-lab-metrics-server
dev-lab-metrics-server: $(HELM) ## Deploy metrics-server helm chart
	@echo Install metrics-server chart... >&2
	@$(HELM) upgrade --install metrics-server --namespace kube-system --wait \
		--repo https://charts.bitnami.com/bitnami metrics-server \
		--values ./scripts/config/dev/metrics-server.yaml

.PHONY: dev-lab-all
dev-lab-all: dev-lab-ingress-ngingx dev-lab-metrics-server dev-lab-prometheus dev-lab-loki dev-lab-tempo dev-lab-otel-collector ## Deploy all dev lab components

.PHONY: dev-lab-policy-reporter
dev-lab-policy-reporter: $(HELM) ## Deploy policy-reporter helm chart
	@echo Install policy-reporter chart... >&2
	@$(HELM) upgrade --install policy-reporter --namespace policy-reporter --create-namespace --wait \
		--repo https://kyverno.github.io/policy-reporter policy-reporter \
		--values ./scripts/config/dev/policy-reporter.yaml

.PHONY: dev-lab-kwok
dev-lab-kwok: ## Deploy kwok
	@kubectl apply -k ./scripts/config/kwok

########
# HELP #
########

.PHONY: help
help: ## Shows the available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-40s\033[0m %s\n", $$1, $$2}'
