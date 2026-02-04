FROM --platform=$BUILDPLATFORM node:17.7-alpine3.14 AS client-builder
WORKDIR /app/client
# cache packages in layer
COPY client/package.json /app/client/package.json
COPY client/package-lock.json /app/client/package-lock.json
RUN --mount=type=cache,target=/usr/src/app/.npm \
    npm set cache /usr/src/app/.npm && \
    npm ci
# install
COPY client /app/client
RUN npm run build

FROM golang:1.17-alpine AS builder
ENV CGO_ENABLED=0
WORKDIR /backend
COPY vm/go.* .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go mod download
COPY vm/. .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go build -trimpath -ldflags="-s -w" -o bin/service

FROM alpine:3.15

LABEL org.opencontainers.image.title="AI-TranspWood codebases in EESSI"
LABEL org.opencontainers.image.description="Docker Extension for accessing the AI-TranspWood European project codebases through an EESSI-enabled JupyterLab instance."
LABEL org.opencontainers.image.vendor="AI-TranspWood"
LABEL com.docker.desktop.extension.api.version=">= 0.2.3"
LABEL com.docker.extension.categories="utility-tools,cloud-development"
LABEL com.docker.extension.publisher-url="https://www.ai-transpwood-project.eu"
LABEL com.docker.extension.additional-urls="[\
    {\
      \"title\":\"Project website\",\
      \"url\":\"https://www.ai-transpwood-project.eu\"\
    },\
    {\
      \"title\":\"Project Github ORG\",\
      \"url\":\"https://github.com/orgs/AI-TranspWood\"\
    },\
    {\
      \"title\":\"EESSI Documentation\",\
      \"url\":\"https://www.eessi.io/docs/\"\
    },\
    {\
      \"title\":\"License\",\
      \"url\":\"https://github.com/AI-TranspWood/jupyter-docker-extension/blob/main/LICENSE\"\
    }\
]"
LABEL com.docker.extension.detailed-description="Docker Extension for accessing the EESSI software stack through a JupyterLab instance."
LABEL com.docker.extension.changelog="See full <a href=\"https://github.com/AI-TranspWood/jupyter-docker-extension/blob/main/CHANGELOG.md\">change log</a>"
LABEL com.docker.desktop.extension.icon="https://raw.githubusercontent.com/AI-TranspWood/jupyter-docker-extension/main/client/public/favicon.ico"
LABEL com.docker.extension.detailed-description="\
<a href=https://www.ai-transpwood-project.eu/>AI-TranspWood (AITW)</a> ambition is to create an AI-driven multiscale methodology for new Safe and Sustainable by Design \
(SSbD), and functional wood-based composites and demonstrate the concept for Transparent Wood (TW), a promising composite \
with potential applications in several industrial fields, such as construction, automotive, electronics and furniture.\
<br>\
Several of the <a href=https://github.com/orgs/AI-TranspWood/repositories>modeling tools developed within AITW</a> are made available through the <a href=https://www.eessi.io/>European Environment for Scientific \
Software Installations (EESSI)</a>.\
<br>\
This extension aims at making these tools easily accessible to users through a JupyterLab interface capable of pulling optimized code binaries directly from EESSI.\
The terminal app available in JupyterLab can also be used by power-users to run the AITW codes through their respective CLIs, \
or any other of the <a href=https://www.eessi.io/docs/available_software/overview/>codes made available through EESSI</a>.\
"
LABEL com.docker.extension.screenshots="[\
    {\"alt\":\"Welcome Page\", \"url\":\"https://raw.githubusercontent.com/AI-TranspWood/jupyter-docker-extension/main/docs/images/landing_page.png\"},\
    {\"alt\":\"JupyterLmod interface to EESSI software stack\", \"url\":\"https://raw.githubusercontent.com/AI-TranspWood/jupyter-docker-extension/main/docs/images/jupyterlmod.png\"},\
    {\"alt\":\"EESSI-enabled Terminal\", \"url\":\"https://raw.githubusercontent.com/AI-TranspWood/jupyter-docker-extension/main/docs/images/terminal.png\"},\
    {\"alt\":\"Dark Mode\", \"url\":\"https://raw.githubusercontent.com/AI-TranspWood/jupyter-docker-extension/main/docs/images/dark_mode.png\"}\
]"

COPY AITW_logo.svg metadata.json docker-compose.yml ./

COPY --from=client-builder /app/client/dist ui
COPY --from=builder /backend/bin/service /

CMD /service -socket /run/guest-services/jupyter-docker-extension.sock
