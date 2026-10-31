#!/usr/bin/env bash
# Google Cloud の初期設定（Cloud Shell で 1 回だけ実行）
#   bash <(curl -fsSL https://raw.githubusercontent.com/kody-takuya/historyofart/HEAD/scripts/gcp-setup.sh)
# 何度実行しても安全です（既存のリソースはそのまま使います）。
set -euo pipefail

REPO="kody-takuya/historyofart"
REGION="asia-northeast1"
SA_NAME="github-deployer"
POOL="github"
PROVIDER="github-provider"

PROJECT_ID="${PROJECT_ID:-$(gcloud projects list --filter='name=historyofart OR projectId=historyofart' --format='value(projectId)' | head -1)}"
if [[ -z "$PROJECT_ID" ]]; then
  echo "historyofart プロジェクトが見つかりません。PROJECT_ID=xxx を付けて実行してください。" >&2
  exit 1
fi
gcloud config set project "$PROJECT_ID" >/dev/null
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
BUCKET="${PROJECT_ID}-media"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "== API を有効化"
gcloud services enable \
  run.googleapis.com artifactregistry.googleapis.com iam.googleapis.com \
  iamcredentials.googleapis.com sts.googleapis.com storage.googleapis.com \
  generativelanguage.googleapis.com apikeys.googleapis.com cloudresourcemanager.googleapis.com

echo "== デプロイ用サービスアカウント"
gcloud iam service-accounts describe "$SA_EMAIL" >/dev/null 2>&1 || \
  gcloud iam service-accounts create "$SA_NAME" --display-name="GitHub Actions deployer"
for role in roles/run.admin roles/artifactregistry.writer roles/iam.serviceAccountUser roles/storage.objectAdmin; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:${SA_EMAIL}" \
    --role="$role" --condition=None >/dev/null
done

echo "== Artifact Registry"
gcloud artifacts repositories describe web --location="$REGION" >/dev/null 2>&1 || \
  gcloud artifacts repositories create web --repository-format=docker --location="$REGION"

echo "== 音声ファイル用バケット（公開読み取り）"
gcloud storage buckets describe "gs://${BUCKET}" >/dev/null 2>&1 || \
  gcloud storage buckets create "gs://${BUCKET}" --location="$REGION" --uniform-bucket-level-access
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
  --member=allUsers --role=roles/storage.objectViewer >/dev/null

echo "== GitHub Actions 用 Workload Identity 連携"
gcloud iam workload-identity-pools describe "$POOL" --location=global >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools create "$POOL" --location=global --display-name="GitHub"
gcloud iam workload-identity-pools providers describe "$PROVIDER" --location=global --workload-identity-pool="$POOL" >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" --location=global \
    --workload-identity-pool="$POOL" --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
    --attribute-condition="assertion.repository=='${REPO}'"
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${REPO}" >/dev/null

echo "== Gemini API キー"
KEY_NAME="$(gcloud services api-keys list --filter='displayName=historyofart-gemini' --format='value(name)' | head -1)"
if [[ -z "$KEY_NAME" ]]; then
  gcloud services api-keys create --display-name=historyofart-gemini \
    --api-target=service=generativelanguage.googleapis.com >/dev/null
  KEY_NAME="$(gcloud services api-keys list --filter='displayName=historyofart-gemini' --format='value(name)' | head -1)"
fi
API_KEY="$(gcloud services api-keys get-key-string "$KEY_NAME" --format='value(keyString)')"

WIF_PROVIDER="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}"
cat <<OUT

==================================================================
GitHub の Settings > Secrets and variables > Actions に登録してください。

[Secrets]
  GEMINI_API_KEY = ${API_KEY}

[Variables]
  GCP_PROJECT_ID   = ${PROJECT_ID}
  GCP_REGION       = ${REGION}
  GCP_WIF_PROVIDER = ${WIF_PROVIDER}
  GCP_SA_EMAIL     = ${SA_EMAIL}
  MEDIA_BUCKET     = ${BUCKET}
==================================================================
OUT
