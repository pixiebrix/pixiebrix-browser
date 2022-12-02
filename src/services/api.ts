/*
 * Copyright (C) 2022 PixieBrix, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import { RegistryId, UUID } from "@/core";
import { BaseQueryFn, createApi } from "@reduxjs/toolkit/query/react";
import {
  EditablePackage,
  Kind,
  RecipeDefinition,
  ServiceDefinition,
  UnsavedRecipeDefinition,
} from "@/types/definitions";
import { AxiosRequestConfig } from "axios";
import { getApiClient, getLinkedApiClient } from "@/services/apiClient";
import {
  CloudExtension,
  Database,
  Group,
  MarketplaceListing,
  MarketplaceTag,
  Me,
  Organization,
  Package,
  PackageUpsertResponse,
  PackageVersion,
  PendingInvitation,
  SanitizedAuth,
  UserRole,
} from "@/types/contract";
import { components } from "@/types/swagger";
import { dumpBrickYaml } from "@/runtime/brickYaml";
import { serializeError } from "serialize-error";
import { UnknownObject } from "@/types";

type QueryArgs = {
  /**
   * The relative PixieBrix URL. The client will apply the configured base service URL.
   */
  url: string;

  /**
   * The REST method
   */
  method: AxiosRequestConfig["method"];

  /**
   * The REST JSON data
   */
  data?: AxiosRequestConfig["data"];

  /**
   * True if a Token is required to make the request.
   * @see isLinked
   */
  requireLinked?: boolean;

  /**
   * Optional additional metadata to pass through to the result.
   */
  meta?: unknown;
};

// https://redux-toolkit.js.org/rtk-query/usage/customizing-queries#axios-basequery
const appBaseQuery: BaseQueryFn<QueryArgs> = async ({
  url,
  method,
  data,
  requireLinked = true,
  meta,
}) => {
  try {
    const client = await (requireLinked
      ? getLinkedApiClient()
      : getApiClient());
    const result = await client({ url, method, data });

    return { data: result.data, meta };
  } catch (error) {
    // Axios offers its own serialization method, but it reshapes the Error object (doesn't include the response, puts the status on the root level). `useToJSON: false` skips that.
    return {
      error: serializeError(error, { useToJSON: false }),
    };
  }
};

export const appApi = createApi({
  reducerPath: "appApi",
  baseQuery: appBaseQuery,
  tagTypes: [
    "Me",
    "Auth",
    "Databases",
    "Services",
    "ServiceAuths",
    "Organizations",
    "Groups",
    "MarketplaceListings",
    "MarketplaceTags",
    "EditablePackages",
    "Invitations",
    "CloudExtensions",
    "Package",
    "PackageVersion",
    "StarterBlueprints",
  ],
  endpoints: (builder) => ({
    getMe: builder.query<Me, void>({
      query: () => ({
        url: "/api/me/",
        method: "get",
        // The /api/me/ endpoint returns a blank result if not authenticated
        requireLinked: false,
      }),
      providesTags: ["Me"],
    }),
    getDatabases: builder.query<Database[], void>({
      query: () => ({ url: "/api/databases/", method: "get" }),
      providesTags: ["Databases"],
    }),
    createDatabase: builder.mutation<
      Database,
      { name: string; organizationId: string }
    >({
      query: ({ name, organizationId }) => ({
        url: organizationId
          ? `/api/organizations/${organizationId}/databases/`
          : "/api/databases/",
        method: "post",
        data: { name },
      }),
      invalidatesTags: ["Databases"],
    }),
    addDatabaseToGroup: builder.mutation<
      Database,
      { groupId: string; databaseIds: string[] }
    >({
      query: ({ groupId, databaseIds }) => ({
        url: `/api/groups/${groupId}/databases/`,
        method: "post",
        data: databaseIds.map((id) => ({
          database: id,
        })),
      }),
      invalidatesTags: ["Databases"],
    }),
    getServices: builder.query<ServiceDefinition[], void>({
      query: () => ({
        url: "/api/services/",
        method: "get",
        // Returns public service definitions if not authenticated
        requireLinked: false,
      }),
      providesTags: ["Services"],
    }),
    getServiceAuths: builder.query<SanitizedAuth[], void>({
      query: () => ({ url: "/api/services/shared/?meta=1", method: "get" }),
      providesTags: ["ServiceAuths"],
    }),
    getOrganizations: builder.query<Organization[], void>({
      query: () => ({ url: "/api/organizations/", method: "get" }),
      providesTags: ["Organizations"],
      transformResponse: (
        baseQueryReturnValue: Array<components["schemas"]["Organization"]>
      ): Organization[] =>
        baseQueryReturnValue.map((apiOrganization) => ({
          ...apiOrganization,

          // Mapping between the API response and the UI model because we need to know whether the user is an admin of
          // the organization

          // Currently API returns all members only for the organization where the user is an admin,
          // hence if the user is an admin, they will have role === UserRole.admin,
          // otherwise there will be no other members listed (no member with role === UserRole.admin).

          // WARNING: currently this role is only accurate for Admin. All other users are passed as Restricted even if
          // they have a Member or Developer role on the team

          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- `organization.members` is about to be removed
          role: (apiOrganization as any).members?.some(
            (member: { role: number }) => member.role === UserRole.admin
          )
            ? UserRole.admin
            : UserRole.restricted,
        })),
    }),
    getGroups: builder.query<Record<string, Group[]>, string>({
      query: (organizationId) => ({
        url: `/api/organizations/${organizationId}/groups/`,
        method: "get",
        meta: { organizationId },
        includeRequestData: true,
      }),
      providesTags: (result, error, organizationId) => [
        { type: "Groups", id: organizationId },
      ],
      transformResponse: (
        baseQueryReturnValue: Group[],
        { organizationId }: { organizationId: string }
      ) => ({
        [organizationId]: baseQueryReturnValue,
      }),
    }),
    getMarketplaceListings: builder.query<
      Record<RegistryId, MarketplaceListing>,
      void
    >({
      query: () => ({
        url: "/api/marketplace/listings/",
        method: "get",
        // Returns public marketplace
        requireLinked: false,
      }),
      providesTags: ["MarketplaceListings"],
      transformResponse(
        baseQueryReturnValue: MarketplaceListing[]
      ): Record<RegistryId, MarketplaceListing> {
        return Object.fromEntries(
          baseQueryReturnValue.map((x) => [x.package.name as RegistryId, x])
        );
      },
    }),
    getMarketplaceTags: builder.query<MarketplaceTag[], void>({
      query: () => ({ url: "/api/marketplace/tags/", method: "get" }),
      providesTags: ["MarketplaceTags"],
    }),
    // ToDo use this query in places where "/api/bricks/" is called
    getEditablePackages: builder.query<EditablePackage[], void>({
      query: () => ({ url: "/api/bricks/", method: "get" }),
      providesTags: ["EditablePackages"],
    }),
    getCloudExtensions: builder.query<CloudExtension[], void>({
      query: () => ({ url: "/api/extensions/", method: "get" }),
      providesTags: ["CloudExtensions"],
    }),
    deleteCloudExtension: builder.mutation<
      CloudExtension,
      { extensionId: UUID }
    >({
      query: ({ extensionId }) => ({
        url: `/api/extensions/${extensionId}/`,
        method: "delete",
      }),
      invalidatesTags: ["CloudExtensions"],
    }),
    createRecipe: builder.mutation<
      PackageUpsertResponse,
      {
        recipe: UnsavedRecipeDefinition;
        organizations: UUID[];
        public: boolean;
        shareDependencies?: boolean;
      }
    >({
      query({ recipe, organizations, public: isPublic, shareDependencies }) {
        const recipeConfig = dumpBrickYaml(recipe);

        return {
          url: "api/bricks/",
          method: "post",
          data: {
            config: recipeConfig,
            kind: "recipe" as Kind,
            organizations,
            public: isPublic,
            share_dependencies: shareDependencies,
          },
        };
      },
      invalidatesTags: ["EditablePackages"],
    }),
    updateRecipe: builder.mutation<
      PackageUpsertResponse,
      { packageId: UUID; recipe: UnsavedRecipeDefinition }
    >({
      query({ packageId, recipe }) {
        const recipeConfig = dumpBrickYaml(recipe);

        return {
          url: `api/bricks/${packageId}/`,
          method: "put",
          data: {
            id: packageId,
            name: recipe.metadata.id,
            config: recipeConfig,
            kind: "recipe" as Kind,
            public: Boolean((recipe as RecipeDefinition).sharing?.public),
            organizations:
              (recipe as RecipeDefinition).sharing?.organizations ?? [],
          },
        };
      },
      invalidatesTags: (result, error, { packageId }) => [
        { type: "Package", id: packageId },
        "EditablePackages",
      ],
    }),
    getInvitations: builder.query<PendingInvitation[], void>({
      query: () => ({ url: "/api/invitations/me", method: "get" }),
      providesTags: ["Invitations"],
    }),
    getPackage: builder.query<Package, { id: UUID }>({
      query: ({ id }) => ({ url: `/api/bricks/${id}/`, method: "get" }),
      providesTags: (result, error, { id }) => [{ type: "Package", id }],
    }),
    createPackage: builder.mutation<PackageUpsertResponse, UnknownObject>({
      query(data) {
        return {
          url: "api/bricks/",
          method: "post",
          data,
        };
      },
      invalidatesTags: ["EditablePackages"],
    }),
    updatePackage: builder.mutation<
      PackageUpsertResponse,
      { id: UUID } & UnknownObject
    >({
      query(data) {
        return {
          url: `api/bricks/${data.id}/`,
          method: "put",
          data,
        };
      },
      invalidatesTags: (result, error, { id }) => [
        { type: "Package", id },
        "EditablePackages",
        "PackageVersion",
      ],
    }),
    deletePackage: builder.mutation<void, { id: UUID }>({
      query({ id }) {
        return { url: `/api/bricks/${id}/`, method: "delete" };
      },
      invalidatesTags: (result, error, { id }) => [
        { type: "Package", id },
        "EditablePackages",
      ],
    }),
    listPackageVersions: builder.query<PackageVersion[], { id: UUID }>({
      query: ({ id }) => ({
        url: `/api/bricks/${id}/versions/`,
        method: "get",
      }),
      providesTags: (result, error, { id }) => [
        { type: "PackageVersion", id: `PACKAGE-${id}-LIST` },
      ],
    }),
    updateScope: builder.mutation<
      unknown, // Not using the result yet, need to refine this type if the future if that changes
      Required<Pick<components["schemas"]["Settings"], "scope">>
    >({
      query: ({ scope }) => ({
        url: "api/settings/",
        method: "patch",
        data: { scope },
      }),
      invalidatesTags: ["Me"],
    }),
    getStarterBlueprints: builder.query<RecipeDefinition[], void>({
      query: () => ({
        url: "/api/onboarding/starter-blueprints/",
        method: "get",
        data: {
          ignore_user_state: true,
        },
      }),
      providesTags: (result, error) => [
        { type: "StarterBlueprints", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useGetMeQuery,
  useGetDatabasesQuery,
  useCreateDatabaseMutation,
  useAddDatabaseToGroupMutation,
  useGetServicesQuery,
  useGetServiceAuthsQuery,
  useGetMarketplaceListingsQuery,
  useGetMarketplaceTagsQuery,
  useGetOrganizationsQuery,
  useGetGroupsQuery,
  useGetCloudExtensionsQuery,
  useDeleteCloudExtensionMutation,
  useGetEditablePackagesQuery,
  useCreateRecipeMutation,
  useUpdateRecipeMutation,
  useGetInvitationsQuery,
  useGetPackageQuery,
  useCreatePackageMutation,
  useUpdatePackageMutation,
  useDeletePackageMutation,
  useListPackageVersionsQuery,
  useUpdateScopeMutation,
  useGetStarterBlueprintsQuery,
  util,
} = appApi;
