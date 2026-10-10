import { Purchases, PurchasesError, ErrorCode } from "@revenuecat/purchases-js";

const PRO_ENTITLEMENT = "adizilla_ai_pro";

let purchases = null;
let currentAppUserId = null;
let apiKeyPromise = null;

async function getWebBillingApiKey() {
  if (!apiKeyPromise) {
    apiKeyPromise = fetch("/api/revenuecat/config", {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      credentials: "same-origin",
    }).then(async (response) => {
      const config = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(config.detail || "Could not load RevenueCat configuration.");
      }
      if (!config.configured || !config.apiKey) {
        throw new Error(config.message ||
          "RevenueCat Web Billing is not configured. Set REVENUECAT_API_KEY to the Web Billing public SDK key (rcb_... or rcb_sb_...).");
      }
      if (!/^rcb(_sb)?_/.test(config.apiKey)) {
        throw new Error("The configured RevenueCat key is not a Web Billing public SDK key.");
      }
      return config.apiKey;
    }).catch((error) => {
      apiKeyPromise = null;
      throw error;
    });
  }
  return apiKeyPromise;
}

export async function connectRevenueCat(firebaseUser) {
  if (!firebaseUser?.uid) {
    throw new Error("Sign in to AdizillaAI before managing a subscription.");
  }

  const apiKey = await getWebBillingApiKey();
  if (!purchases) {
    purchases = Purchases.configure({
      apiKey,
      appUserId: firebaseUser.uid,
    });
    currentAppUserId = firebaseUser.uid;
  } else if (currentAppUserId !== firebaseUser.uid) {
    await purchases.changeUser(firebaseUser.uid);
    currentAppUserId = firebaseUser.uid;
  }

  return purchases;
}

export function hasAdizillaPro(customerInfo) {
  return Boolean(customerInfo?.entitlements?.active?.[PRO_ENTITLEMENT]);
}

export async function getSubscriptionStatus(firebaseUser) {
  const sdk = await connectRevenueCat(firebaseUser);
  const customerInfo = await sdk.getCustomerInfo();
  return { customerInfo, isPro: hasAdizillaPro(customerInfo) };
}

export async function showRevenueCatPaywall(firebaseUser, targetElement) {
  const sdk = await connectRevenueCat(firebaseUser);
  if (!(targetElement instanceof HTMLElement)) {
    throw new Error("The RevenueCat paywall container is missing.");
  }

  const offerings = await sdk.getOfferings();
  if (!offerings.current || offerings.current.availablePackages.length === 0) {
    throw new Error(
      "No packages are available. Configure Web Billing products, attach them to an Offering, and mark it Current in RevenueCat."
    );
  }

  const purchaseResult = await sdk.presentPaywall({
    htmlTarget: targetElement,
    offering: offerings.current,
  });

  const customerInfo = purchaseResult?.customerInfo || await sdk.getCustomerInfo();
  return {
    customerInfo,
    isPro: hasAdizillaPro(customerInfo),
    redemptionInfo: purchaseResult?.redemptionInfo || null,
  };
}

export async function purchasePackage(firebaseUser, packageIdentifier) {
  const sdk = await connectRevenueCat(firebaseUser);
  const offerings = await sdk.getOfferings();
  const offering = offerings.current;
  if (!offering) throw new Error("No Current Offering is configured.");

  const selectedPackage = offering.availablePackages.find(
    (item) => item.identifier === packageIdentifier
  );
  if (!selectedPackage) {
    throw new Error(`Package "${packageIdentifier}" was not found in the Current Offering.`);
  }

  const { customerInfo, redemptionInfo } = await sdk.purchase({
    rcPackage: selectedPackage,
  });
  return {
    customerInfo,
    redemptionInfo,
    isPro: hasAdizillaPro(customerInfo),
  };
}

export function isPurchaseCancelled(error) {
  return error instanceof PurchasesError &&
    error.errorCode === ErrorCode.UserCancelledError;
}
