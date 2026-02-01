const syncPlanToBilling = async (company) => {
  console.log(
    `Syncing company ${company.id} to billing: plan=${company.plan}, status=${company.subscriptionStatus}`,
  );
  return new Promise((resolve) => setTimeout(resolve, 200));
};

const ensureBillingCustomer = async (company) => {
  if (company.billingCustomerId) {
    return company.billingCustomerId;
  }

  console.log(`Creating billing customer for company ${company.id}`);
  await new Promise((resolve) => setTimeout(resolve, 200));
  return `cust_${company.id}`;
};

module.exports = {
  syncPlanToBilling,
  ensureBillingCustomer,
};
