all: clean extension install

ORG=aitranspwood
JUPYTER_IMAGE_NAME=ghcr.io/ai-transpwood/eessi_jupyterlab:0.1.6
VERSION=1.0
MINOR=7
IMAGE_NAME=$(ORG)/jupyter-docker-extension
TAGGED_IMAGE_NAME=$(IMAGE_NAME):$(VERSION).${MINOR}
TAGGED_IMAGE_NAME_LATEST=$(IMAGE_NAME):latest

clean:
	-docker extension rm $(IMAGE_NAME)
	-docker rmi $(TAGGED_IMAGE_NAME)

extension:
	docker buildx build -t $(TAGGED_IMAGE_NAME) --build-arg VERSION=$(VERSION) --build-arg JUPYTER_IMAGE_NAME=$(JUPYTER_IMAGE_NAME) .

install: extension
	docker extension install -f $(TAGGED_IMAGE_NAME)

debug:
	docker extension dev debug $(TAGGED_IMAGE_NAME)

undebug:
	docker extension dev reset $(TAGGED_IMAGE_NAME)

validate: extension
	docker extension  validate $(TAGGED_IMAGE_NAME)

update: extension
	docker extension update $(TAGGED_IMAGE_NAME)

multiarch:
	docker buildx create --name=buildx-multi-arch --driver=docker-container --driver-opt=network=host

build:
	docker buildx build --output=type=docker --builder=buildx-multi-arch --platform=linux/amd64,linux/arm64 --build-arg JUPYTER_IMAGE_NAME=$(JUPYTER_IMAGE_NAME) --tag=$(TAGGED_IMAGE_NAME) --tag=$(TAGGED_IMAGE_NAME_LATEST) .

publish:
	docker buildx build --push --builder=buildx-multi-arch --platform=linux/amd64,linux/arm64 --build-arg JUPYTER_IMAGE_NAME=$(JUPYTER_IMAGE_NAME) --tag=$(TAGGED_IMAGE_NAME) --tag=$(TAGGED_IMAGE_NAME_LATEST) .
