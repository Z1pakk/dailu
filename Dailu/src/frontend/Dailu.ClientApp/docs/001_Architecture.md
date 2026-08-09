# Angular Project Architecture

Inspired from:

https://www.angular.courses/blog/angular-folder-structure-guide
https://blog.stackademic.com/best-angular-folder-structure-for-large-teams-2025-guide-acb61babaf28

## Architecture Structure

The project follows a modular architecture structure, with the following key directories:

- Non-business feature (/src/app/core folder)
- Business feature (/src/app/modules folder)
- Shared feature (/src/app/shared folder)
- Assets (/src/app/assets folder)

The directory structure is as follows:

    src/
    ├── app/
        ├── core/               → Global services (auth, logger, layout, interceptors, global provides, routes)
            ├── layout
            │   ├── main-layout
            │   ├── auth-layout
            ├── auth
            │   ├── auth-store.ts
            │   ├── auth-store.spec.ts
            │   ├── auth.model.ts
            │   ├── auth-guard.ts
            │   ├── auth-guard.spec.ts
            │   ├── auth.routes.ts
            │   └── pages
            │       ├── login
            │       ├── register
            │       ├── password-recovery
            ├── services
            │   ├── notification.service.ts
            │   └── notification.service.spec.ts
            └── interceptors
                ├── api.interceptor.ts
                └── api.interceptor.spec.ts
            └── provides
                ├── transloco.provider.ts
                └──
        ├── shared/             → UI-only, reusable components, pipes, utils
            ├── ui
            │   ├── notification.ts
            │   ├── notification.spec.ts
            │   ├── notification.html
            │   └── notification.css
            ├── pipes
            │   ├── date-pipe.ts
            │   └── date-pipe.spec.ts
            └── utils
                ├── array.utils.ts
                └── array.utils.spec.ts
        ├── modules/           → Business domains (users, reports, dashboard)
            ├── dashboard/
            ├── reports/
            ├── users/
            └── checkout/
                ├── checkout.api.ts
                ├── checkout.api.spec.ts
                ├── requests
                    └── checkout.request.ts  → Request entity send to the backend
                ├── responses
                    └── checkout.response.ts  → Response entity received from the backend
                ├── entities
                    └── checkout.entity.ts  → Common entity which may be used in both requests and responses
                ├── models  → Models used in the frontend for the checkout feature
                    └── checkout.model.ts
                ├── enums  → Enums used in the checkout feature
                    └── checkout.enum.ts
                ├── checkout.guard.ts
                ├── checkout.guard.spec.ts
                ├── checkout.routes.ts
                └── pages       → Specific pages for the checkout feature
                    ├── address
                        ├── ui  → Components specific to address page
                        ├── services
                        ├── models
                        ├── directives
                        ├── pipes
                    └── payment
        └── app.routes.ts       → Global routing setup
    ├── assets/
    ├── environments/
    └── main.ts

## Non-business feature (/src/app/core folder)

A non-business feature is a feature that is not specific to the business domain of the application.

Some examples are:

- the layout of your application
- the authentication process
- the global notifications
- App-wide HTTP interceptors
- Logging service
- Layout service
- Shell or base route guards
- Global interceptors

There might be pages and components that are part of the core module, such as:

- the login page
- the registration page
- the password recovery page

## Business feature (/src/app/modules folder)

A business feature is a feature that is specific to the business domain of the application. <br />
They should be in their own folder under the /src/app/modules directory and might contain inner pages/components/services/models/pipes/directives folders. <br />

Some examples are:

- the user management feature /src/app/modules/reports
- the reporting feature /src/app/modules/reports
- the dashboard feature /src/app/modules/dashboard
- the checkout feature /src/app/modules/checkout
-

## Shared feature (/src/app/shared folder)

The shared code is the code that is shared between the different features of the application. There are two kinds of code being shared between features:

- the one including some business logic
- the one that doesn’t.

The shared code lives in the src/app/shared folder.

## Assets (/src/assets folder)

The assets folder contains static files such as images, fonts, and stylesheets that are used throughout the application.
It is a good practice to organize the assets into subfolders based on their type or purpose, such as:

- images/
- fonts/
- styles/
- icons/

## Environments (/src/environments folder)

The environments folder contains configuration files for different environments, such as development, staging, and production. These files typically include settings such as API endpoints, feature flags, and other environment-specific configurations.
The environment files are named according to the environment they represent, such as:

- environment.ts (default development environment)
- environment.prod.ts (production environment)
- environment.staging.ts (staging environment)
