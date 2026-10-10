import { Purchases, PurchasesError, ErrorCode } from "@revenuecat/purchases-js";

const API_KEY = import.meta.env.VITE_REVENUECAT_WEB_API_KEY;
const PRO_ENTITLEMENT = "adizilla_ai_pro";

let purchases = null;
let currentAppUserId = null;

function assertConfigured() {
  if (!API_KEY || !/^rcb(_sb)?_/.test(API_KEY)) {
    throw new Error(
      "RevenueCat Web Billing is not configured. Add VITE_REVENUECAT_WEB_API_KEY using the Web Billing public key from RevenueCat (rcb_... or rcb_sb_...)."
    );
  }
}

export async function connectRevenueCat(firebaseUser) {
  if (!firebaseUser?.uid) {
    throw new Error("Sign in to AdizillaAI before managing a subscription.");
  }
  assertConfigured();

  if (!purchases) {
    purchases = Purchases.configure({
      apiKey: API_KEY,
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
      "No packages are available. Configure products, attach them to an Offering, and mark it Current in RevenueCat."
    );
  }

  await sdk.presentPaywall({
    htmlTarget: targetElement,
    offering: offerings.current,
  });

  const customerInfo = await sdk.getCustomerInfo();
  return { customerInfo, isPro: hasAdizillaPro(customerInfo) };
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
