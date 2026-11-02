import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Provision an account and root user only when supplied via the
  // environment. With nothing configured this seed creates no identities.
  const accountId = process.env.SEED_ACCOUNT_ID;
  const accountAlias = process.env.SEED_ACCOUNT_ALIAS;
  const accountName = process.env.SEED_ACCOUNT_NAME;
  const rootEmail = process.env.SEED_ROOT_EMAIL;
  const rootUsername = process.env.SEED_ROOT_USERNAME || 'root';
  const rootPassword = process.env.SEED_ROOT_PASSWORD;

  let account: any = null;
  let rootUser: any = null;

  if (accountId && rootEmail && rootPassword) {
    account = await prisma.account.upsert({
      where: { id: accountId },
      update: {},
      create: {
        id: accountId,
        name: accountName || accountId,
        accountAlias: accountAlias || null,
      },
    });

    const salt = await bcrypt.genSalt(12);
    rootUser = await prisma.user.findFirst({ where: { email: rootEmail } });
    if (!rootUser) {
      rootUser = await prisma.user.create({
        data: {
          accountId: account.id,
          username: rootUsername,
          email: rootEmail,
          passwordHash: await bcrypt.hash(rootPassword, salt),
          isRoot: true,
          isMfaEnabled: false,
        },
      });
    }

    await prisma.account.update({
      where: { id: account.id },
      data: { rootUserId: rootUser.id },
    });

    console.log(`Provisioned account ${account.id} with root user ${rootUser.email}`);
  } else {
    account = await prisma.account.findFirst();
    if (!account) {
      console.log('No account to seed: set SEED_ACCOUNT_ID, SEED_ROOT_EMAIL and SEED_ROOT_PASSWORD, or create an account first.');
      return;
    }
    console.log(`Seeding system policies and roles into existing account ${account.id}`);
  }

  // 3. Create Default System Policies
  const policiesData = [
    {
      name: 'AdministratorAccess',
      description: 'Provides full access to AWS services and resources across the account.',
      isSystem: true,
      document: {
        Version: '2026-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: ['*'],
            Resource: ['*'],
          },
        ],
      },
    },
    {
      name: 'UserAndRoleManagement',
      description: 'Allows managing users, roles, groups, policies and viewing audit logs. No billing access.',
      isSystem: true,
      document: {
        Version: '2026-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: [
              'users:*',
              'roles:*',
              'policies:*',
              'groups:*',
              'audit:*',
            ],
            Resource: ['*'],
          },
          {
            Effect: 'Deny',
            Action: ['billing:*'],
            Resource: ['*'],
          },
        ],
      },
    },
    {
      name: 'DeveloperAccess',
      description: 'Allows reading and writing application resources, compute, database, and storage.',
      isSystem: true,
      document: {
        Version: '2026-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: [
              'resources:*',
              'compute:*',
              'storage:*',
              'database:*',
              'users:read',
            ],
            Resource: ['*'],
          },
          {
            Effect: 'Deny',
            Action: ['billing:*', 'roles:delete', 'policies:delete'],
            Resource: ['*'],
          },
        ],
      },
    },
    {
      name: 'BillingAccess',
      description: 'Provides full access to billing, invoices, payment methods, and cost explorer.',
      isSystem: true,
      document: {
        Version: '2026-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: ['billing:*'],
            Resource: ['*'],
          },
        ],
      },
    },
    {
      name: 'ReadOnlyAccess',
      description: 'Provides read-only access to all services and resources.',
      isSystem: true,
      document: {
        Version: '2026-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: ['*:read', '*:list', '*:describe', '*:get'],
            Resource: ['*'],
          },
        ],
      },
    },
  ];

  const createdPolicies: Record<string, any> = {};
  for (const pol of policiesData) {
    const created = await prisma.policy.create({
      data: {
        accountId: account.id,
        name: pol.name,
        description: pol.description,
        isSystem: pol.isSystem,
        document: pol.document,
      },
    });
    createdPolicies[pol.name] = created;
    console.log(`Created Policy: ${pol.name}`);
  }

  // 4. Create Default Roles & Attach Policies
  const rolesData = [
    {
      name: 'Root',
      description: 'Account Owner with unconstrained superuser privileges.',
      isSystem: true,
      policyNames: ['AdministratorAccess'],
    },
    {
      name: 'Admin',
      description: 'Administrator capable of managing users, roles, groups, and audit logs.',
      isSystem: true,
      policyNames: ['UserAndRoleManagement'],
    },
    {
      name: 'Developer',
      description: 'Software engineer with read/write access to development resources.',
      isSystem: true,
      policyNames: ['DeveloperAccess'],
    },
    {
      name: 'Billing',
      description: 'Finance specialist with access to invoices and payment methods.',
      isSystem: true,
      policyNames: ['BillingAccess'],
    },
    {
      name: 'ReadOnly',
      description: 'Auditor or observer with read-only inspection capabilities.',
      isSystem: true,
      policyNames: ['ReadOnlyAccess'],
    },
    {
      name: 'Doctor',
      description: 'Attending physician and clinician with diagnostic imaging and orders permissions.',
      isSystem: true,
      policyNames: ['ReadOnlyAccess', 'DeveloperAccess'],
    },
    {
      name: 'Patient',
      description: 'Registered patient with personal health records and results access.',
      isSystem: true,
      policyNames: ['ReadOnlyAccess'],
    },
  ];

  const createdRoles: Record<string, any> = {};
  for (const r of rolesData) {
    const createdRole = await prisma.role.create({
      data: {
        accountId: account.id,
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
      },
    });
    createdRoles[r.name] = createdRole;

    for (const policyName of r.policyNames) {
      const policy = createdPolicies[policyName];
      if (policy) {
        await prisma.rolePolicy.create({
          data: {
            roleId: createdRole.id,
            policyId: policy.id,
          },
        });
      }
    }
    console.log(`Created Role: ${r.name} with policies: ${r.policyNames.join(', ')}`);
  }

  // Assign Root role to the provisioned root user, when one exists
  if (rootUser) {
    await prisma.userRole.create({
      data: {
        userId: rootUser.id,
        roleId: createdRoles['Root'].id,
      },
    });
  }

  console.log('✅ Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
