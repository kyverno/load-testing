############
# DEFAULTS #
############

KIND_IMAGE           ?= kindest/node:v1.27.3
KIND_NAME            ?= kind
KIND_CONFIG          ?= default

#########
# TOOLS #
#########

TOOLS_DIR                          := $(PWD)/.tools
KIND                               := $(TOOLS_DIR)/kind
KIND_VERSION                       := v0.20.0
HELM                               := $(TOOLS_DIR)/helm
HELM_VERSION                       := v3.12.3
HELM_DOCS                          := $(TOOLS_DIR)/helm-docs
HELM_DOCS_VERSION                  := v1.11.0

$(KIND):
	@echo Install kind... >&2
	@GOBIN=$(TOOLS_DIR) go install sigs.k8s.io/kind@$(KIND_VERSION)

$(HELM):
	@echo Install helm... >&2
	@GOBIN=$(TOOLS_DIR) go install helm.sh/helm/v3/cmd/helm@$(HELM_VERSION)

########
# HELM #
########

.PHONY: helm-add-repo # Add Kyverno chart repository
	@echo Add kyverno chart... >&2
	@$(HELM) repo add kyverno https://kyverno.github.io/kyverno/

########
# KIND #
########

.PHONY: kind-create-cluster
kind-create-cluster: $(KIND) ## Create kind cluster
	@echo Create kind cluster... >&2
	@$(KIND) create cluster --name $(KIND_NAME) --image $(KIND_IMAGE) --config ./configs/kind/default.yaml

.PHONY: kind-install-kyverno
kind-install-kyverno: $(HELM) helm-add-repo ## Install kyverno helm chart
	@echo Install kyverno chart... >&2
	@$(HELM) upgrade --install kyverno --namespace kyverno --create-namespace --wait kyverno/kyverno --devel --values ./configs/kyverno/kyverno.yaml