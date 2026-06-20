const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
const callbackUrl = process.env.SHOPIFY_ADVENTURE_WEBHOOK_URL;
const apiVersion = process.env.SHOPIFY_API_VERSION || '2026-04';

const topics = [
  'ORDERS_PAID',
  'ORDERS_CANCELLED',
  'REFUNDS_CREATE'
];

if (!shopDomain || !token || !callbackUrl) {
  console.error('Set SHOPIFY_SHOP_DOMAIN, SHOPIFY_ADMIN_ACCESS_TOKEN, and SHOPIFY_ADVENTURE_WEBHOOK_URL.');
  process.exit(1);
}

const mutation = `
  mutation AdventureWebhookCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
    webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
      webhookSubscription {
        id
        topic
        format
        uri
      }
      userErrors {
        field
        message
      }
    }
  }
`;

async function createWebhook(topic) {
  const response = await fetch(`https://${shopDomain}/admin/api/${apiVersion}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token
    },
    body: JSON.stringify({
      query: mutation,
      variables: {
        topic,
        webhookSubscription: {
          uri: callbackUrl,
          format: 'JSON'
        }
      }
    })
  });

  const body = await response.json();
  if (!response.ok || body.errors?.length) {
    throw new Error(`${topic}: ${JSON.stringify(body.errors || body)}`);
  }

  const result = body.data.webhookSubscriptionCreate;
  if (result.userErrors.length) {
    throw new Error(`${topic}: ${JSON.stringify(result.userErrors)}`);
  }

  return result.webhookSubscription;
}

for (const topic of topics) {
  try {
    const webhook = await createWebhook(topic);
    console.log(`Created ${webhook.topic}: ${webhook.id}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
