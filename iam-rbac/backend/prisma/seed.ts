import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Create or ensure sample Account
  const accountAlias = 'aws-prod';
  const existingAccount = await prisma.account.findUnique({
    where: { accountAlias },
  });

  if (existingAccount) {
    console.log('Account already exists, skipping full seed.');
    return;
  }

  const account = await prisma.account.create({
    data: {
      id: '123456789012',
      name: 'AWS Production Organization',
      accountAlias,
    },
  });

  console.log(`Created Account: ${account.name} (ID: ${account.id}, Alias: ${account.accountAlias})`);

  // 2. Create Root User
  const salt = await bcrypt.genSalt(12);
  const rootPasswordHash = await bcrypt.hash('AdminRoot@123456', salt);

  const rootUser = await prisma.user.create({
    data: {
      accountId: account.id,
      username: 'root',
      email: 'root@aws-example.com',
      passwordHash: rootPasswordHash,
      isRoot: true,
      isMfaEnabled: false,
    },
  });

  await prisma.account.update({
    where: { id: account.id },
    data: { rootUserId: rootUser.id },
  });

  console.log(`Created Root User: ${rootUser.email} (Password: AdminRoot@123456)`);

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

  // Assign Root role to Root user
  await prisma.userRole.create({
    data: {
      userId: rootUser.id,
      roleId: createdRoles['Root'].id,
    },
  });

  // 5. Create Sample IAM User (alice.dev)
  const alicePasswordHash = await bcrypt.hash('AliceDev@123456', salt);
  const aliceUser = await prisma.user.create({
    data: {
      accountId: account.id,
      username: 'alice.dev',
      email: 'alice@company.internal',
      passwordHash: alicePasswordHash,
      isRoot: false,
      isMfaEnabled: false,
    },
  });

  await prisma.userRole.create({
    data: {
      userId: aliceUser.id,
      roleId: createdRoles['Developer'].id,
    },
  });

  console.log(`Created Sample IAM User: ${aliceUser.username} (Password: AliceDev@123456) with role: Developer`);

  // 6. Create Sample Group (Developers)
  const devGroup = await prisma.group.create({
    data: {
      accountId: account.id,
      name: 'EngineeringTeam',
      description: 'Core Engineering development and delivery group.',
    },
  });

  await prisma.groupRole.create({
    data: {
      groupId: devGroup.id,
      roleId: createdRoles['Developer'].id,
    },
  });

  await prisma.userGroup.create({
    data: {
      userId: aliceUser.id,
      groupId: devGroup.id,
    },
  });

  console.log(`Created Group: ${devGroup.name} with user ${aliceUser.username}`);

  // 7. Seed Initial Audit Log
  await prisma.auditLog.create({
    data: {
      accountId: account.id,
      userId: rootUser.id,
      action: 'account:initial_setup',
      resource: `account:${account.id}`,
      effect: 'ALLOW',
      ipAddress: '127.0.0.1',
      userAgent: 'System Seed Script',
      details: { message: 'Organization account initialized with system roles and policies.' },
    },
  });

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
