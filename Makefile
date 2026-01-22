all: clean extension install

ORG=my
JUPYTER_IMAGE_NAME=eessi_jlab
VERSION=1.0
MINOR=0
IMAGE_NAME=$(ORG)/jupyter-docker-extension-eessi
TAGGED_IMAGE_NAME=$(IMAGE_NAME):$(VERSION).${MINOR}

clean:
	-docker extension rm $(IMAGE_NAME)
	-docker rmi $(TAGGED_IMAGE_NAME)

# Todo: Probably better to seprate the jupyter image into a dedicated image and just pull it
extension:
	docker buildx build -t ${JUPYTER_IMAGE_NAME} -f Dockerfile-sidecar .
	docker buildx build -t $(TAGGED_IMAGE_NAME) --build-arg VERSION=$(VERSION) --build-arg JUPYTER_IMAGE_NAME=$(JUPYTER_IMAGE_NAME) .

install:
	docker extension install -f $(TAGGED_IMAGE_NAME)

validate: extension
	docker extension  validate $(TAGGED_IMAGE_NAME)

update: extension
	docker extension update $(TAGGED_IMAGE_NAME)

multiarch:
	docker buildx create --name=buildx-multi-arch --driver=docker-container --driver-opt=network=host

build:
	docker buildx build --push --builder=buildx-multi-arch --platform=linux/amd64,linux/arm64 --build-arg JUPYTER_IMAGE_NAME=$(JUPYTER_IMAGE_NAME) --tag=$(TAGGED_IMAGE_NAME) .
