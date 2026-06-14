
/**
 * Client
**/

import * as runtime from './runtime/client.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model User
 * 
 */
export type User = $Result.DefaultSelection<Prisma.$UserPayload>
/**
 * Model UserRoleAssignment
 * 
 */
export type UserRoleAssignment = $Result.DefaultSelection<Prisma.$UserRoleAssignmentPayload>
/**
 * Model AuthToken
 * 
 */
export type AuthToken = $Result.DefaultSelection<Prisma.$AuthTokenPayload>
/**
 * Model RoleInvitation
 * 
 */
export type RoleInvitation = $Result.DefaultSelection<Prisma.$RoleInvitationPayload>
/**
 * Model LearnerProfile
 * 
 */
export type LearnerProfile = $Result.DefaultSelection<Prisma.$LearnerProfilePayload>
/**
 * Model SupplierProfile
 * 
 */
export type SupplierProfile = $Result.DefaultSelection<Prisma.$SupplierProfilePayload>
/**
 * Model Location
 * 
 */
export type Location = $Result.DefaultSelection<Prisma.$LocationPayload>

/**
 * Enums
 */
export namespace $Enums {
  export const UserRole: {
  LEARNER: 'LEARNER',
  SUPPLIER: 'SUPPLIER',
  DRIVER: 'DRIVER',
  MODERATOR: 'MODERATOR',
  ADMIN: 'ADMIN'
};

export type UserRole = (typeof UserRole)[keyof typeof UserRole]


export const AccountStatus: {
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  DISABLED: 'DISABLED'
};

export type AccountStatus = (typeof AccountStatus)[keyof typeof AccountStatus]


export const AuthTokenType: {
  EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
  PHONE_OTP: 'PHONE_OTP',
  PASSWORD_RESET: 'PASSWORD_RESET',
  REFRESH_TOKEN: 'REFRESH_TOKEN'
};

export type AuthTokenType = (typeof AuthTokenType)[keyof typeof AuthTokenType]


export const RoleInvitationTargetRole: {
  DRIVER: 'DRIVER',
  MODERATOR: 'MODERATOR',
  ADMIN: 'ADMIN'
};

export type RoleInvitationTargetRole = (typeof RoleInvitationTargetRole)[keyof typeof RoleInvitationTargetRole]


export const RoleInvitationStatus: {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED'
};

export type RoleInvitationStatus = (typeof RoleInvitationStatus)[keyof typeof RoleInvitationStatus]

}

export type UserRole = $Enums.UserRole

export const UserRole: typeof $Enums.UserRole

export type AccountStatus = $Enums.AccountStatus

export const AccountStatus: typeof $Enums.AccountStatus

export type AuthTokenType = $Enums.AuthTokenType

export const AuthTokenType: typeof $Enums.AuthTokenType

export type RoleInvitationTargetRole = $Enums.RoleInvitationTargetRole

export const RoleInvitationTargetRole: typeof $Enums.RoleInvitationTargetRole

export type RoleInvitationStatus = $Enums.RoleInvitationStatus

export const RoleInvitationStatus: typeof $Enums.RoleInvitationStatus

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient({
 *   adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
 * })
 * // Fetch zero or more Users
 * const users = await prisma.user.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://pris.ly/d/client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  const U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient({
   *   adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
   * })
   * // Fetch zero or more Users
   * const users = await prisma.user.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://pris.ly/d/client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/orm/prisma-client/queries/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>

  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb<ClientOptions>, ExtArgs, $Utils.Call<Prisma.TypeMapCb<ClientOptions>, {
    extArgs: ExtArgs
  }>>

      /**
   * `prisma.user`: Exposes CRUD operations for the **User** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Users
    * const users = await prisma.user.findMany()
    * ```
    */
  get user(): Prisma.UserDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.userRoleAssignment`: Exposes CRUD operations for the **UserRoleAssignment** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more UserRoleAssignments
    * const userRoleAssignments = await prisma.userRoleAssignment.findMany()
    * ```
    */
  get userRoleAssignment(): Prisma.UserRoleAssignmentDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.authToken`: Exposes CRUD operations for the **AuthToken** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more AuthTokens
    * const authTokens = await prisma.authToken.findMany()
    * ```
    */
  get authToken(): Prisma.AuthTokenDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.roleInvitation`: Exposes CRUD operations for the **RoleInvitation** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more RoleInvitations
    * const roleInvitations = await prisma.roleInvitation.findMany()
    * ```
    */
  get roleInvitation(): Prisma.RoleInvitationDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.learnerProfile`: Exposes CRUD operations for the **LearnerProfile** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more LearnerProfiles
    * const learnerProfiles = await prisma.learnerProfile.findMany()
    * ```
    */
  get learnerProfile(): Prisma.LearnerProfileDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.supplierProfile`: Exposes CRUD operations for the **SupplierProfile** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more SupplierProfiles
    * const supplierProfiles = await prisma.supplierProfile.findMany()
    * ```
    */
  get supplierProfile(): Prisma.SupplierProfileDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.location`: Exposes CRUD operations for the **Location** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Locations
    * const locations = await prisma.location.findMany()
    * ```
    */
  get location(): Prisma.LocationDelegate<ExtArgs, ClientOptions>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 7.8.0
   * Query Engine version: 3c6e192761c0362d496ed980de936e2f3cebcd3a
   */
  export type PrismaVersion = {
    client: string
    engine: string
  }

  export const prismaVersion: PrismaVersion

  /**
   * Utility Types
   */


  export import Bytes = runtime.Bytes
  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? P : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    User: 'User',
    UserRoleAssignment: 'UserRoleAssignment',
    AuthToken: 'AuthToken',
    RoleInvitation: 'RoleInvitation',
    LearnerProfile: 'LearnerProfile',
    SupplierProfile: 'SupplierProfile',
    Location: 'Location'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]



  interface TypeMapCb<ClientOptions = {}> extends $Utils.Fn<{extArgs: $Extensions.InternalArgs }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
      omit: GlobalOmitOptions
    }
    meta: {
      modelProps: "user" | "userRoleAssignment" | "authToken" | "roleInvitation" | "learnerProfile" | "supplierProfile" | "location"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      User: {
        payload: Prisma.$UserPayload<ExtArgs>
        fields: Prisma.UserFieldRefs
        operations: {
          findUnique: {
            args: Prisma.UserFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.UserFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findFirst: {
            args: Prisma.UserFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.UserFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findMany: {
            args: Prisma.UserFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          create: {
            args: Prisma.UserCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          createMany: {
            args: Prisma.UserCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.UserCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          delete: {
            args: Prisma.UserDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          update: {
            args: Prisma.UserUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          deleteMany: {
            args: Prisma.UserDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.UserUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.UserUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          upsert: {
            args: Prisma.UserUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          aggregate: {
            args: Prisma.UserAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateUser>
          }
          groupBy: {
            args: Prisma.UserGroupByArgs<ExtArgs>
            result: $Utils.Optional<UserGroupByOutputType>[]
          }
          count: {
            args: Prisma.UserCountArgs<ExtArgs>
            result: $Utils.Optional<UserCountAggregateOutputType> | number
          }
        }
      }
      UserRoleAssignment: {
        payload: Prisma.$UserRoleAssignmentPayload<ExtArgs>
        fields: Prisma.UserRoleAssignmentFieldRefs
        operations: {
          findUnique: {
            args: Prisma.UserRoleAssignmentFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserRoleAssignmentPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.UserRoleAssignmentFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserRoleAssignmentPayload>
          }
          findFirst: {
            args: Prisma.UserRoleAssignmentFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserRoleAssignmentPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.UserRoleAssignmentFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserRoleAssignmentPayload>
          }
          findMany: {
            args: Prisma.UserRoleAssignmentFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserRoleAssignmentPayload>[]
          }
          create: {
            args: Prisma.UserRoleAssignmentCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserRoleAssignmentPayload>
          }
          createMany: {
            args: Prisma.UserRoleAssignmentCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.UserRoleAssignmentCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserRoleAssignmentPayload>[]
          }
          delete: {
            args: Prisma.UserRoleAssignmentDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserRoleAssignmentPayload>
          }
          update: {
            args: Prisma.UserRoleAssignmentUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserRoleAssignmentPayload>
          }
          deleteMany: {
            args: Prisma.UserRoleAssignmentDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.UserRoleAssignmentUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.UserRoleAssignmentUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserRoleAssignmentPayload>[]
          }
          upsert: {
            args: Prisma.UserRoleAssignmentUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserRoleAssignmentPayload>
          }
          aggregate: {
            args: Prisma.UserRoleAssignmentAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateUserRoleAssignment>
          }
          groupBy: {
            args: Prisma.UserRoleAssignmentGroupByArgs<ExtArgs>
            result: $Utils.Optional<UserRoleAssignmentGroupByOutputType>[]
          }
          count: {
            args: Prisma.UserRoleAssignmentCountArgs<ExtArgs>
            result: $Utils.Optional<UserRoleAssignmentCountAggregateOutputType> | number
          }
        }
      }
      AuthToken: {
        payload: Prisma.$AuthTokenPayload<ExtArgs>
        fields: Prisma.AuthTokenFieldRefs
        operations: {
          findUnique: {
            args: Prisma.AuthTokenFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AuthTokenPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.AuthTokenFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AuthTokenPayload>
          }
          findFirst: {
            args: Prisma.AuthTokenFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AuthTokenPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.AuthTokenFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AuthTokenPayload>
          }
          findMany: {
            args: Prisma.AuthTokenFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AuthTokenPayload>[]
          }
          create: {
            args: Prisma.AuthTokenCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AuthTokenPayload>
          }
          createMany: {
            args: Prisma.AuthTokenCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.AuthTokenCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AuthTokenPayload>[]
          }
          delete: {
            args: Prisma.AuthTokenDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AuthTokenPayload>
          }
          update: {
            args: Prisma.AuthTokenUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AuthTokenPayload>
          }
          deleteMany: {
            args: Prisma.AuthTokenDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.AuthTokenUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.AuthTokenUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AuthTokenPayload>[]
          }
          upsert: {
            args: Prisma.AuthTokenUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AuthTokenPayload>
          }
          aggregate: {
            args: Prisma.AuthTokenAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateAuthToken>
          }
          groupBy: {
            args: Prisma.AuthTokenGroupByArgs<ExtArgs>
            result: $Utils.Optional<AuthTokenGroupByOutputType>[]
          }
          count: {
            args: Prisma.AuthTokenCountArgs<ExtArgs>
            result: $Utils.Optional<AuthTokenCountAggregateOutputType> | number
          }
        }
      }
      RoleInvitation: {
        payload: Prisma.$RoleInvitationPayload<ExtArgs>
        fields: Prisma.RoleInvitationFieldRefs
        operations: {
          findUnique: {
            args: Prisma.RoleInvitationFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RoleInvitationPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.RoleInvitationFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RoleInvitationPayload>
          }
          findFirst: {
            args: Prisma.RoleInvitationFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RoleInvitationPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.RoleInvitationFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RoleInvitationPayload>
          }
          findMany: {
            args: Prisma.RoleInvitationFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RoleInvitationPayload>[]
          }
          create: {
            args: Prisma.RoleInvitationCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RoleInvitationPayload>
          }
          createMany: {
            args: Prisma.RoleInvitationCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.RoleInvitationCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RoleInvitationPayload>[]
          }
          delete: {
            args: Prisma.RoleInvitationDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RoleInvitationPayload>
          }
          update: {
            args: Prisma.RoleInvitationUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RoleInvitationPayload>
          }
          deleteMany: {
            args: Prisma.RoleInvitationDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.RoleInvitationUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.RoleInvitationUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RoleInvitationPayload>[]
          }
          upsert: {
            args: Prisma.RoleInvitationUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RoleInvitationPayload>
          }
          aggregate: {
            args: Prisma.RoleInvitationAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateRoleInvitation>
          }
          groupBy: {
            args: Prisma.RoleInvitationGroupByArgs<ExtArgs>
            result: $Utils.Optional<RoleInvitationGroupByOutputType>[]
          }
          count: {
            args: Prisma.RoleInvitationCountArgs<ExtArgs>
            result: $Utils.Optional<RoleInvitationCountAggregateOutputType> | number
          }
        }
      }
      LearnerProfile: {
        payload: Prisma.$LearnerProfilePayload<ExtArgs>
        fields: Prisma.LearnerProfileFieldRefs
        operations: {
          findUnique: {
            args: Prisma.LearnerProfileFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LearnerProfilePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.LearnerProfileFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LearnerProfilePayload>
          }
          findFirst: {
            args: Prisma.LearnerProfileFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LearnerProfilePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.LearnerProfileFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LearnerProfilePayload>
          }
          findMany: {
            args: Prisma.LearnerProfileFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LearnerProfilePayload>[]
          }
          create: {
            args: Prisma.LearnerProfileCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LearnerProfilePayload>
          }
          createMany: {
            args: Prisma.LearnerProfileCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.LearnerProfileCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LearnerProfilePayload>[]
          }
          delete: {
            args: Prisma.LearnerProfileDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LearnerProfilePayload>
          }
          update: {
            args: Prisma.LearnerProfileUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LearnerProfilePayload>
          }
          deleteMany: {
            args: Prisma.LearnerProfileDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.LearnerProfileUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.LearnerProfileUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LearnerProfilePayload>[]
          }
          upsert: {
            args: Prisma.LearnerProfileUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LearnerProfilePayload>
          }
          aggregate: {
            args: Prisma.LearnerProfileAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateLearnerProfile>
          }
          groupBy: {
            args: Prisma.LearnerProfileGroupByArgs<ExtArgs>
            result: $Utils.Optional<LearnerProfileGroupByOutputType>[]
          }
          count: {
            args: Prisma.LearnerProfileCountArgs<ExtArgs>
            result: $Utils.Optional<LearnerProfileCountAggregateOutputType> | number
          }
        }
      }
      SupplierProfile: {
        payload: Prisma.$SupplierProfilePayload<ExtArgs>
        fields: Prisma.SupplierProfileFieldRefs
        operations: {
          findUnique: {
            args: Prisma.SupplierProfileFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SupplierProfilePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.SupplierProfileFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SupplierProfilePayload>
          }
          findFirst: {
            args: Prisma.SupplierProfileFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SupplierProfilePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.SupplierProfileFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SupplierProfilePayload>
          }
          findMany: {
            args: Prisma.SupplierProfileFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SupplierProfilePayload>[]
          }
          create: {
            args: Prisma.SupplierProfileCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SupplierProfilePayload>
          }
          createMany: {
            args: Prisma.SupplierProfileCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.SupplierProfileCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SupplierProfilePayload>[]
          }
          delete: {
            args: Prisma.SupplierProfileDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SupplierProfilePayload>
          }
          update: {
            args: Prisma.SupplierProfileUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SupplierProfilePayload>
          }
          deleteMany: {
            args: Prisma.SupplierProfileDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.SupplierProfileUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.SupplierProfileUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SupplierProfilePayload>[]
          }
          upsert: {
            args: Prisma.SupplierProfileUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SupplierProfilePayload>
          }
          aggregate: {
            args: Prisma.SupplierProfileAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateSupplierProfile>
          }
          groupBy: {
            args: Prisma.SupplierProfileGroupByArgs<ExtArgs>
            result: $Utils.Optional<SupplierProfileGroupByOutputType>[]
          }
          count: {
            args: Prisma.SupplierProfileCountArgs<ExtArgs>
            result: $Utils.Optional<SupplierProfileCountAggregateOutputType> | number
          }
        }
      }
      Location: {
        payload: Prisma.$LocationPayload<ExtArgs>
        fields: Prisma.LocationFieldRefs
        operations: {
          findUnique: {
            args: Prisma.LocationFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LocationPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.LocationFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LocationPayload>
          }
          findFirst: {
            args: Prisma.LocationFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LocationPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.LocationFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LocationPayload>
          }
          findMany: {
            args: Prisma.LocationFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LocationPayload>[]
          }
          create: {
            args: Prisma.LocationCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LocationPayload>
          }
          createMany: {
            args: Prisma.LocationCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.LocationCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LocationPayload>[]
          }
          delete: {
            args: Prisma.LocationDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LocationPayload>
          }
          update: {
            args: Prisma.LocationUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LocationPayload>
          }
          deleteMany: {
            args: Prisma.LocationDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.LocationUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.LocationUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LocationPayload>[]
          }
          upsert: {
            args: Prisma.LocationUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LocationPayload>
          }
          aggregate: {
            args: Prisma.LocationAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateLocation>
          }
          groupBy: {
            args: Prisma.LocationGroupByArgs<ExtArgs>
            result: $Utils.Optional<LocationGroupByOutputType>[]
          }
          count: {
            args: Prisma.LocationCountArgs<ExtArgs>
            result: $Utils.Optional<LocationCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Shorthand for `emit: 'stdout'`
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events only
     * log: [
     *   { emit: 'event', level: 'query' },
     *   { emit: 'event', level: 'info' },
     *   { emit: 'event', level: 'warn' }
     *   { emit: 'event', level: 'error' }
     * ]
     * 
     * / Emit as events and log to stdout
     * og: [
     *  { emit: 'stdout', level: 'query' },
     *  { emit: 'stdout', level: 'info' },
     *  { emit: 'stdout', level: 'warn' }
     *  { emit: 'stdout', level: 'error' }
     * 
     * ```
     * Read more in our [docs](https://pris.ly/d/logging).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
    /**
     * Instance of a Driver Adapter, e.g., like one provided by `@prisma/adapter-planetscale`
     */
    adapter?: runtime.SqlDriverAdapterFactory
    /**
     * Prisma Accelerate URL allowing the client to connect through Accelerate instead of a direct database.
     */
    accelerateUrl?: string
    /**
     * Global configuration for omitting model fields by default.
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig
    /**
     * SQL commenter plugins that add metadata to SQL queries as comments.
     * Comments follow the sqlcommenter format: https://google.github.io/sqlcommenter/
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   adapter,
     *   comments: [
     *     traceContext(),
     *     queryInsights(),
     *   ],
     * })
     * ```
     */
    comments?: runtime.SqlCommenterPlugin[]
  }
  export type GlobalOmitConfig = {
    user?: UserOmit
    userRoleAssignment?: UserRoleAssignmentOmit
    authToken?: AuthTokenOmit
    roleInvitation?: RoleInvitationOmit
    learnerProfile?: LearnerProfileOmit
    supplierProfile?: SupplierProfileOmit
    location?: LocationOmit
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type CheckIsLogLevel<T> = T extends LogLevel ? T : never;

  export type GetLogType<T> = CheckIsLogLevel<
    T extends LogDefinition ? T['level'] : T
  >;

  export type GetEvents<T extends any[]> = T extends Array<LogLevel | LogDefinition>
    ? GetLogType<T[number]>
    : never;

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'updateManyAndReturn'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type UserCountOutputType
   */

  export type UserCountOutputType = {
    roles: number
    authTokens: number
    invitedRoles: number
    usedInvitations: number
    assignedRoles: number
  }

  export type UserCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    roles?: boolean | UserCountOutputTypeCountRolesArgs
    authTokens?: boolean | UserCountOutputTypeCountAuthTokensArgs
    invitedRoles?: boolean | UserCountOutputTypeCountInvitedRolesArgs
    usedInvitations?: boolean | UserCountOutputTypeCountUsedInvitationsArgs
    assignedRoles?: boolean | UserCountOutputTypeCountAssignedRolesArgs
  }

  // Custom InputTypes
  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserCountOutputType
     */
    select?: UserCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountRolesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserRoleAssignmentWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountAuthTokensArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: AuthTokenWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountInvitedRolesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: RoleInvitationWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountUsedInvitationsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: RoleInvitationWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountAssignedRolesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserRoleAssignmentWhereInput
  }


  /**
   * Count Type LocationCountOutputType
   */

  export type LocationCountOutputType = {
    supplierPickupFor: number
  }

  export type LocationCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    supplierPickupFor?: boolean | LocationCountOutputTypeCountSupplierPickupForArgs
  }

  // Custom InputTypes
  /**
   * LocationCountOutputType without action
   */
  export type LocationCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LocationCountOutputType
     */
    select?: LocationCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * LocationCountOutputType without action
   */
  export type LocationCountOutputTypeCountSupplierPickupForArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: SupplierProfileWhereInput
  }


  /**
   * Models
   */

  /**
   * Model User
   */

  export type AggregateUser = {
    _count: UserCountAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  export type UserMinAggregateOutputType = {
    id: string | null
    displayName: string | null
    email: string | null
    phone: string | null
    passwordHash: string | null
    accountStatus: $Enums.AccountStatus | null
    profileImageUrl: string | null
    emailVerifiedAt: Date | null
    phoneVerifiedAt: Date | null
    lastLoginAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UserMaxAggregateOutputType = {
    id: string | null
    displayName: string | null
    email: string | null
    phone: string | null
    passwordHash: string | null
    accountStatus: $Enums.AccountStatus | null
    profileImageUrl: string | null
    emailVerifiedAt: Date | null
    phoneVerifiedAt: Date | null
    lastLoginAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UserCountAggregateOutputType = {
    id: number
    displayName: number
    email: number
    phone: number
    passwordHash: number
    accountStatus: number
    profileImageUrl: number
    emailVerifiedAt: number
    phoneVerifiedAt: number
    lastLoginAt: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type UserMinAggregateInputType = {
    id?: true
    displayName?: true
    email?: true
    phone?: true
    passwordHash?: true
    accountStatus?: true
    profileImageUrl?: true
    emailVerifiedAt?: true
    phoneVerifiedAt?: true
    lastLoginAt?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UserMaxAggregateInputType = {
    id?: true
    displayName?: true
    email?: true
    phone?: true
    passwordHash?: true
    accountStatus?: true
    profileImageUrl?: true
    emailVerifiedAt?: true
    phoneVerifiedAt?: true
    lastLoginAt?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UserCountAggregateInputType = {
    id?: true
    displayName?: true
    email?: true
    phone?: true
    passwordHash?: true
    accountStatus?: true
    profileImageUrl?: true
    emailVerifiedAt?: true
    phoneVerifiedAt?: true
    lastLoginAt?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type UserAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which User to aggregate.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Users
    **/
    _count?: true | UserCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: UserMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: UserMaxAggregateInputType
  }

  export type GetUserAggregateType<T extends UserAggregateArgs> = {
        [P in keyof T & keyof AggregateUser]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUser[P]>
      : GetScalarType<T[P], AggregateUser[P]>
  }




  export type UserGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserWhereInput
    orderBy?: UserOrderByWithAggregationInput | UserOrderByWithAggregationInput[]
    by: UserScalarFieldEnum[] | UserScalarFieldEnum
    having?: UserScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: UserCountAggregateInputType | true
    _min?: UserMinAggregateInputType
    _max?: UserMaxAggregateInputType
  }

  export type UserGroupByOutputType = {
    id: string
    displayName: string
    email: string
    phone: string | null
    passwordHash: string
    accountStatus: $Enums.AccountStatus
    profileImageUrl: string | null
    emailVerifiedAt: Date | null
    phoneVerifiedAt: Date | null
    lastLoginAt: Date | null
    createdAt: Date
    updatedAt: Date
    _count: UserCountAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  type GetUserGroupByPayload<T extends UserGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UserGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof UserGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], UserGroupByOutputType[P]>
            : GetScalarType<T[P], UserGroupByOutputType[P]>
        }
      >
    >


  export type UserSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    displayName?: boolean
    email?: boolean
    phone?: boolean
    passwordHash?: boolean
    accountStatus?: boolean
    profileImageUrl?: boolean
    emailVerifiedAt?: boolean
    phoneVerifiedAt?: boolean
    lastLoginAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    roles?: boolean | User$rolesArgs<ExtArgs>
    authTokens?: boolean | User$authTokensArgs<ExtArgs>
    learnerProfile?: boolean | User$learnerProfileArgs<ExtArgs>
    supplierProfile?: boolean | User$supplierProfileArgs<ExtArgs>
    invitedRoles?: boolean | User$invitedRolesArgs<ExtArgs>
    usedInvitations?: boolean | User$usedInvitationsArgs<ExtArgs>
    assignedRoles?: boolean | User$assignedRolesArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["user"]>

  export type UserSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    displayName?: boolean
    email?: boolean
    phone?: boolean
    passwordHash?: boolean
    accountStatus?: boolean
    profileImageUrl?: boolean
    emailVerifiedAt?: boolean
    phoneVerifiedAt?: boolean
    lastLoginAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["user"]>

  export type UserSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    displayName?: boolean
    email?: boolean
    phone?: boolean
    passwordHash?: boolean
    accountStatus?: boolean
    profileImageUrl?: boolean
    emailVerifiedAt?: boolean
    phoneVerifiedAt?: boolean
    lastLoginAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["user"]>

  export type UserSelectScalar = {
    id?: boolean
    displayName?: boolean
    email?: boolean
    phone?: boolean
    passwordHash?: boolean
    accountStatus?: boolean
    profileImageUrl?: boolean
    emailVerifiedAt?: boolean
    phoneVerifiedAt?: boolean
    lastLoginAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type UserOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "displayName" | "email" | "phone" | "passwordHash" | "accountStatus" | "profileImageUrl" | "emailVerifiedAt" | "phoneVerifiedAt" | "lastLoginAt" | "createdAt" | "updatedAt", ExtArgs["result"]["user"]>
  export type UserInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    roles?: boolean | User$rolesArgs<ExtArgs>
    authTokens?: boolean | User$authTokensArgs<ExtArgs>
    learnerProfile?: boolean | User$learnerProfileArgs<ExtArgs>
    supplierProfile?: boolean | User$supplierProfileArgs<ExtArgs>
    invitedRoles?: boolean | User$invitedRolesArgs<ExtArgs>
    usedInvitations?: boolean | User$usedInvitationsArgs<ExtArgs>
    assignedRoles?: boolean | User$assignedRolesArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type UserIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type UserIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $UserPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "User"
    objects: {
      roles: Prisma.$UserRoleAssignmentPayload<ExtArgs>[]
      authTokens: Prisma.$AuthTokenPayload<ExtArgs>[]
      learnerProfile: Prisma.$LearnerProfilePayload<ExtArgs> | null
      supplierProfile: Prisma.$SupplierProfilePayload<ExtArgs> | null
      invitedRoles: Prisma.$RoleInvitationPayload<ExtArgs>[]
      usedInvitations: Prisma.$RoleInvitationPayload<ExtArgs>[]
      assignedRoles: Prisma.$UserRoleAssignmentPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      displayName: string
      email: string
      phone: string | null
      passwordHash: string
      accountStatus: $Enums.AccountStatus
      profileImageUrl: string | null
      emailVerifiedAt: Date | null
      phoneVerifiedAt: Date | null
      lastLoginAt: Date | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["user"]>
    composites: {}
  }

  type UserGetPayload<S extends boolean | null | undefined | UserDefaultArgs> = $Result.GetResult<Prisma.$UserPayload, S>

  type UserCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<UserFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: UserCountAggregateInputType | true
    }

  export interface UserDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['User'], meta: { name: 'User' } }
    /**
     * Find zero or one User that matches the filter.
     * @param {UserFindUniqueArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends UserFindUniqueArgs>(args: SelectSubset<T, UserFindUniqueArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one User that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {UserFindUniqueOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends UserFindUniqueOrThrowArgs>(args: SelectSubset<T, UserFindUniqueOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends UserFindFirstArgs>(args?: SelectSubset<T, UserFindFirstArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends UserFindFirstOrThrowArgs>(args?: SelectSubset<T, UserFindFirstOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Users that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Users
     * const users = await prisma.user.findMany()
     * 
     * // Get first 10 Users
     * const users = await prisma.user.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const userWithIdOnly = await prisma.user.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends UserFindManyArgs>(args?: SelectSubset<T, UserFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a User.
     * @param {UserCreateArgs} args - Arguments to create a User.
     * @example
     * // Create one User
     * const User = await prisma.user.create({
     *   data: {
     *     // ... data to create a User
     *   }
     * })
     * 
     */
    create<T extends UserCreateArgs>(args: SelectSubset<T, UserCreateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Users.
     * @param {UserCreateManyArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends UserCreateManyArgs>(args?: SelectSubset<T, UserCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Users and returns the data saved in the database.
     * @param {UserCreateManyAndReturnArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Users and only return the `id`
     * const userWithIdOnly = await prisma.user.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends UserCreateManyAndReturnArgs>(args?: SelectSubset<T, UserCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a User.
     * @param {UserDeleteArgs} args - Arguments to delete one User.
     * @example
     * // Delete one User
     * const User = await prisma.user.delete({
     *   where: {
     *     // ... filter to delete one User
     *   }
     * })
     * 
     */
    delete<T extends UserDeleteArgs>(args: SelectSubset<T, UserDeleteArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one User.
     * @param {UserUpdateArgs} args - Arguments to update one User.
     * @example
     * // Update one User
     * const user = await prisma.user.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends UserUpdateArgs>(args: SelectSubset<T, UserUpdateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Users.
     * @param {UserDeleteManyArgs} args - Arguments to filter Users to delete.
     * @example
     * // Delete a few Users
     * const { count } = await prisma.user.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends UserDeleteManyArgs>(args?: SelectSubset<T, UserDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends UserUpdateManyArgs>(args: SelectSubset<T, UserUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users and returns the data updated in the database.
     * @param {UserUpdateManyAndReturnArgs} args - Arguments to update many Users.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Users and only return the `id`
     * const userWithIdOnly = await prisma.user.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends UserUpdateManyAndReturnArgs>(args: SelectSubset<T, UserUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one User.
     * @param {UserUpsertArgs} args - Arguments to update or create a User.
     * @example
     * // Update or create a User
     * const user = await prisma.user.upsert({
     *   create: {
     *     // ... data to create a User
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the User we want to update
     *   }
     * })
     */
    upsert<T extends UserUpsertArgs>(args: SelectSubset<T, UserUpsertArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserCountArgs} args - Arguments to filter Users to count.
     * @example
     * // Count the number of Users
     * const count = await prisma.user.count({
     *   where: {
     *     // ... the filter for the Users we want to count
     *   }
     * })
    **/
    count<T extends UserCountArgs>(
      args?: Subset<T, UserCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UserCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends UserAggregateArgs>(args: Subset<T, UserAggregateArgs>): Prisma.PrismaPromise<GetUserAggregateType<T>>

    /**
     * Group by User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends UserGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UserGroupByArgs['orderBy'] }
        : { orderBy?: UserGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, UserGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUserGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the User model
   */
  readonly fields: UserFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for User.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__UserClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    roles<T extends User$rolesArgs<ExtArgs> = {}>(args?: Subset<T, User$rolesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserRoleAssignmentPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    authTokens<T extends User$authTokensArgs<ExtArgs> = {}>(args?: Subset<T, User$authTokensArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AuthTokenPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    learnerProfile<T extends User$learnerProfileArgs<ExtArgs> = {}>(args?: Subset<T, User$learnerProfileArgs<ExtArgs>>): Prisma__LearnerProfileClient<$Result.GetResult<Prisma.$LearnerProfilePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    supplierProfile<T extends User$supplierProfileArgs<ExtArgs> = {}>(args?: Subset<T, User$supplierProfileArgs<ExtArgs>>): Prisma__SupplierProfileClient<$Result.GetResult<Prisma.$SupplierProfilePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    invitedRoles<T extends User$invitedRolesArgs<ExtArgs> = {}>(args?: Subset<T, User$invitedRolesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RoleInvitationPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    usedInvitations<T extends User$usedInvitationsArgs<ExtArgs> = {}>(args?: Subset<T, User$usedInvitationsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RoleInvitationPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    assignedRoles<T extends User$assignedRolesArgs<ExtArgs> = {}>(args?: Subset<T, User$assignedRolesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserRoleAssignmentPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the User model
   */
  interface UserFieldRefs {
    readonly id: FieldRef<"User", 'String'>
    readonly displayName: FieldRef<"User", 'String'>
    readonly email: FieldRef<"User", 'String'>
    readonly phone: FieldRef<"User", 'String'>
    readonly passwordHash: FieldRef<"User", 'String'>
    readonly accountStatus: FieldRef<"User", 'AccountStatus'>
    readonly profileImageUrl: FieldRef<"User", 'String'>
    readonly emailVerifiedAt: FieldRef<"User", 'DateTime'>
    readonly phoneVerifiedAt: FieldRef<"User", 'DateTime'>
    readonly lastLoginAt: FieldRef<"User", 'DateTime'>
    readonly createdAt: FieldRef<"User", 'DateTime'>
    readonly updatedAt: FieldRef<"User", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * User findUnique
   */
  export type UserFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findUniqueOrThrow
   */
  export type UserFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findFirst
   */
  export type UserFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findFirstOrThrow
   */
  export type UserFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findMany
   */
  export type UserFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which Users to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User create
   */
  export type UserCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to create a User.
     */
    data: XOR<UserCreateInput, UserUncheckedCreateInput>
  }

  /**
   * User createMany
   */
  export type UserCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * User createManyAndReturn
   */
  export type UserCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * User update
   */
  export type UserUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to update a User.
     */
    data: XOR<UserUpdateInput, UserUncheckedUpdateInput>
    /**
     * Choose, which User to update.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User updateMany
   */
  export type UserUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to update.
     */
    limit?: number
  }

  /**
   * User updateManyAndReturn
   */
  export type UserUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to update.
     */
    limit?: number
  }

  /**
   * User upsert
   */
  export type UserUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The filter to search for the User to update in case it exists.
     */
    where: UserWhereUniqueInput
    /**
     * In case the User found by the `where` argument doesn't exist, create a new User with this data.
     */
    create: XOR<UserCreateInput, UserUncheckedCreateInput>
    /**
     * In case the User was found with the provided `where` argument, update it with this data.
     */
    update: XOR<UserUpdateInput, UserUncheckedUpdateInput>
  }

  /**
   * User delete
   */
  export type UserDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter which User to delete.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User deleteMany
   */
  export type UserDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Users to delete
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to delete.
     */
    limit?: number
  }

  /**
   * User.roles
   */
  export type User$rolesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserRoleAssignment
     */
    select?: UserRoleAssignmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserRoleAssignment
     */
    omit?: UserRoleAssignmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserRoleAssignmentInclude<ExtArgs> | null
    where?: UserRoleAssignmentWhereInput
    orderBy?: UserRoleAssignmentOrderByWithRelationInput | UserRoleAssignmentOrderByWithRelationInput[]
    cursor?: UserRoleAssignmentWhereUniqueInput
    take?: number
    skip?: number
    distinct?: UserRoleAssignmentScalarFieldEnum | UserRoleAssignmentScalarFieldEnum[]
  }

  /**
   * User.authTokens
   */
  export type User$authTokensArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AuthToken
     */
    select?: AuthTokenSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AuthToken
     */
    omit?: AuthTokenOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuthTokenInclude<ExtArgs> | null
    where?: AuthTokenWhereInput
    orderBy?: AuthTokenOrderByWithRelationInput | AuthTokenOrderByWithRelationInput[]
    cursor?: AuthTokenWhereUniqueInput
    take?: number
    skip?: number
    distinct?: AuthTokenScalarFieldEnum | AuthTokenScalarFieldEnum[]
  }

  /**
   * User.learnerProfile
   */
  export type User$learnerProfileArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LearnerProfile
     */
    select?: LearnerProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the LearnerProfile
     */
    omit?: LearnerProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LearnerProfileInclude<ExtArgs> | null
    where?: LearnerProfileWhereInput
  }

  /**
   * User.supplierProfile
   */
  export type User$supplierProfileArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SupplierProfile
     */
    select?: SupplierProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SupplierProfile
     */
    omit?: SupplierProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SupplierProfileInclude<ExtArgs> | null
    where?: SupplierProfileWhereInput
  }

  /**
   * User.invitedRoles
   */
  export type User$invitedRolesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RoleInvitation
     */
    select?: RoleInvitationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RoleInvitation
     */
    omit?: RoleInvitationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RoleInvitationInclude<ExtArgs> | null
    where?: RoleInvitationWhereInput
    orderBy?: RoleInvitationOrderByWithRelationInput | RoleInvitationOrderByWithRelationInput[]
    cursor?: RoleInvitationWhereUniqueInput
    take?: number
    skip?: number
    distinct?: RoleInvitationScalarFieldEnum | RoleInvitationScalarFieldEnum[]
  }

  /**
   * User.usedInvitations
   */
  export type User$usedInvitationsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RoleInvitation
     */
    select?: RoleInvitationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RoleInvitation
     */
    omit?: RoleInvitationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RoleInvitationInclude<ExtArgs> | null
    where?: RoleInvitationWhereInput
    orderBy?: RoleInvitationOrderByWithRelationInput | RoleInvitationOrderByWithRelationInput[]
    cursor?: RoleInvitationWhereUniqueInput
    take?: number
    skip?: number
    distinct?: RoleInvitationScalarFieldEnum | RoleInvitationScalarFieldEnum[]
  }

  /**
   * User.assignedRoles
   */
  export type User$assignedRolesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserRoleAssignment
     */
    select?: UserRoleAssignmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserRoleAssignment
     */
    omit?: UserRoleAssignmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserRoleAssignmentInclude<ExtArgs> | null
    where?: UserRoleAssignmentWhereInput
    orderBy?: UserRoleAssignmentOrderByWithRelationInput | UserRoleAssignmentOrderByWithRelationInput[]
    cursor?: UserRoleAssignmentWhereUniqueInput
    take?: number
    skip?: number
    distinct?: UserRoleAssignmentScalarFieldEnum | UserRoleAssignmentScalarFieldEnum[]
  }

  /**
   * User without action
   */
  export type UserDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
  }


  /**
   * Model UserRoleAssignment
   */

  export type AggregateUserRoleAssignment = {
    _count: UserRoleAssignmentCountAggregateOutputType | null
    _min: UserRoleAssignmentMinAggregateOutputType | null
    _max: UserRoleAssignmentMaxAggregateOutputType | null
  }

  export type UserRoleAssignmentMinAggregateOutputType = {
    id: string | null
    userId: string | null
    role: $Enums.UserRole | null
    isPrimary: boolean | null
    assignedBy: string | null
    createdAt: Date | null
  }

  export type UserRoleAssignmentMaxAggregateOutputType = {
    id: string | null
    userId: string | null
    role: $Enums.UserRole | null
    isPrimary: boolean | null
    assignedBy: string | null
    createdAt: Date | null
  }

  export type UserRoleAssignmentCountAggregateOutputType = {
    id: number
    userId: number
    role: number
    isPrimary: number
    assignedBy: number
    createdAt: number
    _all: number
  }


  export type UserRoleAssignmentMinAggregateInputType = {
    id?: true
    userId?: true
    role?: true
    isPrimary?: true
    assignedBy?: true
    createdAt?: true
  }

  export type UserRoleAssignmentMaxAggregateInputType = {
    id?: true
    userId?: true
    role?: true
    isPrimary?: true
    assignedBy?: true
    createdAt?: true
  }

  export type UserRoleAssignmentCountAggregateInputType = {
    id?: true
    userId?: true
    role?: true
    isPrimary?: true
    assignedBy?: true
    createdAt?: true
    _all?: true
  }

  export type UserRoleAssignmentAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which UserRoleAssignment to aggregate.
     */
    where?: UserRoleAssignmentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserRoleAssignments to fetch.
     */
    orderBy?: UserRoleAssignmentOrderByWithRelationInput | UserRoleAssignmentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: UserRoleAssignmentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserRoleAssignments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserRoleAssignments.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned UserRoleAssignments
    **/
    _count?: true | UserRoleAssignmentCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: UserRoleAssignmentMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: UserRoleAssignmentMaxAggregateInputType
  }

  export type GetUserRoleAssignmentAggregateType<T extends UserRoleAssignmentAggregateArgs> = {
        [P in keyof T & keyof AggregateUserRoleAssignment]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUserRoleAssignment[P]>
      : GetScalarType<T[P], AggregateUserRoleAssignment[P]>
  }




  export type UserRoleAssignmentGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserRoleAssignmentWhereInput
    orderBy?: UserRoleAssignmentOrderByWithAggregationInput | UserRoleAssignmentOrderByWithAggregationInput[]
    by: UserRoleAssignmentScalarFieldEnum[] | UserRoleAssignmentScalarFieldEnum
    having?: UserRoleAssignmentScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: UserRoleAssignmentCountAggregateInputType | true
    _min?: UserRoleAssignmentMinAggregateInputType
    _max?: UserRoleAssignmentMaxAggregateInputType
  }

  export type UserRoleAssignmentGroupByOutputType = {
    id: string
    userId: string
    role: $Enums.UserRole
    isPrimary: boolean
    assignedBy: string | null
    createdAt: Date
    _count: UserRoleAssignmentCountAggregateOutputType | null
    _min: UserRoleAssignmentMinAggregateOutputType | null
    _max: UserRoleAssignmentMaxAggregateOutputType | null
  }

  type GetUserRoleAssignmentGroupByPayload<T extends UserRoleAssignmentGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UserRoleAssignmentGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof UserRoleAssignmentGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], UserRoleAssignmentGroupByOutputType[P]>
            : GetScalarType<T[P], UserRoleAssignmentGroupByOutputType[P]>
        }
      >
    >


  export type UserRoleAssignmentSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    role?: boolean
    isPrimary?: boolean
    assignedBy?: boolean
    createdAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
    assignedByUser?: boolean | UserRoleAssignment$assignedByUserArgs<ExtArgs>
  }, ExtArgs["result"]["userRoleAssignment"]>

  export type UserRoleAssignmentSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    role?: boolean
    isPrimary?: boolean
    assignedBy?: boolean
    createdAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
    assignedByUser?: boolean | UserRoleAssignment$assignedByUserArgs<ExtArgs>
  }, ExtArgs["result"]["userRoleAssignment"]>

  export type UserRoleAssignmentSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    role?: boolean
    isPrimary?: boolean
    assignedBy?: boolean
    createdAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
    assignedByUser?: boolean | UserRoleAssignment$assignedByUserArgs<ExtArgs>
  }, ExtArgs["result"]["userRoleAssignment"]>

  export type UserRoleAssignmentSelectScalar = {
    id?: boolean
    userId?: boolean
    role?: boolean
    isPrimary?: boolean
    assignedBy?: boolean
    createdAt?: boolean
  }

  export type UserRoleAssignmentOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "userId" | "role" | "isPrimary" | "assignedBy" | "createdAt", ExtArgs["result"]["userRoleAssignment"]>
  export type UserRoleAssignmentInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
    assignedByUser?: boolean | UserRoleAssignment$assignedByUserArgs<ExtArgs>
  }
  export type UserRoleAssignmentIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
    assignedByUser?: boolean | UserRoleAssignment$assignedByUserArgs<ExtArgs>
  }
  export type UserRoleAssignmentIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
    assignedByUser?: boolean | UserRoleAssignment$assignedByUserArgs<ExtArgs>
  }

  export type $UserRoleAssignmentPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "UserRoleAssignment"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
      assignedByUser: Prisma.$UserPayload<ExtArgs> | null
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      userId: string
      role: $Enums.UserRole
      isPrimary: boolean
      assignedBy: string | null
      createdAt: Date
    }, ExtArgs["result"]["userRoleAssignment"]>
    composites: {}
  }

  type UserRoleAssignmentGetPayload<S extends boolean | null | undefined | UserRoleAssignmentDefaultArgs> = $Result.GetResult<Prisma.$UserRoleAssignmentPayload, S>

  type UserRoleAssignmentCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<UserRoleAssignmentFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: UserRoleAssignmentCountAggregateInputType | true
    }

  export interface UserRoleAssignmentDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['UserRoleAssignment'], meta: { name: 'UserRoleAssignment' } }
    /**
     * Find zero or one UserRoleAssignment that matches the filter.
     * @param {UserRoleAssignmentFindUniqueArgs} args - Arguments to find a UserRoleAssignment
     * @example
     * // Get one UserRoleAssignment
     * const userRoleAssignment = await prisma.userRoleAssignment.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends UserRoleAssignmentFindUniqueArgs>(args: SelectSubset<T, UserRoleAssignmentFindUniqueArgs<ExtArgs>>): Prisma__UserRoleAssignmentClient<$Result.GetResult<Prisma.$UserRoleAssignmentPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one UserRoleAssignment that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {UserRoleAssignmentFindUniqueOrThrowArgs} args - Arguments to find a UserRoleAssignment
     * @example
     * // Get one UserRoleAssignment
     * const userRoleAssignment = await prisma.userRoleAssignment.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends UserRoleAssignmentFindUniqueOrThrowArgs>(args: SelectSubset<T, UserRoleAssignmentFindUniqueOrThrowArgs<ExtArgs>>): Prisma__UserRoleAssignmentClient<$Result.GetResult<Prisma.$UserRoleAssignmentPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first UserRoleAssignment that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserRoleAssignmentFindFirstArgs} args - Arguments to find a UserRoleAssignment
     * @example
     * // Get one UserRoleAssignment
     * const userRoleAssignment = await prisma.userRoleAssignment.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends UserRoleAssignmentFindFirstArgs>(args?: SelectSubset<T, UserRoleAssignmentFindFirstArgs<ExtArgs>>): Prisma__UserRoleAssignmentClient<$Result.GetResult<Prisma.$UserRoleAssignmentPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first UserRoleAssignment that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserRoleAssignmentFindFirstOrThrowArgs} args - Arguments to find a UserRoleAssignment
     * @example
     * // Get one UserRoleAssignment
     * const userRoleAssignment = await prisma.userRoleAssignment.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends UserRoleAssignmentFindFirstOrThrowArgs>(args?: SelectSubset<T, UserRoleAssignmentFindFirstOrThrowArgs<ExtArgs>>): Prisma__UserRoleAssignmentClient<$Result.GetResult<Prisma.$UserRoleAssignmentPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more UserRoleAssignments that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserRoleAssignmentFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all UserRoleAssignments
     * const userRoleAssignments = await prisma.userRoleAssignment.findMany()
     * 
     * // Get first 10 UserRoleAssignments
     * const userRoleAssignments = await prisma.userRoleAssignment.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const userRoleAssignmentWithIdOnly = await prisma.userRoleAssignment.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends UserRoleAssignmentFindManyArgs>(args?: SelectSubset<T, UserRoleAssignmentFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserRoleAssignmentPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a UserRoleAssignment.
     * @param {UserRoleAssignmentCreateArgs} args - Arguments to create a UserRoleAssignment.
     * @example
     * // Create one UserRoleAssignment
     * const UserRoleAssignment = await prisma.userRoleAssignment.create({
     *   data: {
     *     // ... data to create a UserRoleAssignment
     *   }
     * })
     * 
     */
    create<T extends UserRoleAssignmentCreateArgs>(args: SelectSubset<T, UserRoleAssignmentCreateArgs<ExtArgs>>): Prisma__UserRoleAssignmentClient<$Result.GetResult<Prisma.$UserRoleAssignmentPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many UserRoleAssignments.
     * @param {UserRoleAssignmentCreateManyArgs} args - Arguments to create many UserRoleAssignments.
     * @example
     * // Create many UserRoleAssignments
     * const userRoleAssignment = await prisma.userRoleAssignment.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends UserRoleAssignmentCreateManyArgs>(args?: SelectSubset<T, UserRoleAssignmentCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many UserRoleAssignments and returns the data saved in the database.
     * @param {UserRoleAssignmentCreateManyAndReturnArgs} args - Arguments to create many UserRoleAssignments.
     * @example
     * // Create many UserRoleAssignments
     * const userRoleAssignment = await prisma.userRoleAssignment.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many UserRoleAssignments and only return the `id`
     * const userRoleAssignmentWithIdOnly = await prisma.userRoleAssignment.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends UserRoleAssignmentCreateManyAndReturnArgs>(args?: SelectSubset<T, UserRoleAssignmentCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserRoleAssignmentPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a UserRoleAssignment.
     * @param {UserRoleAssignmentDeleteArgs} args - Arguments to delete one UserRoleAssignment.
     * @example
     * // Delete one UserRoleAssignment
     * const UserRoleAssignment = await prisma.userRoleAssignment.delete({
     *   where: {
     *     // ... filter to delete one UserRoleAssignment
     *   }
     * })
     * 
     */
    delete<T extends UserRoleAssignmentDeleteArgs>(args: SelectSubset<T, UserRoleAssignmentDeleteArgs<ExtArgs>>): Prisma__UserRoleAssignmentClient<$Result.GetResult<Prisma.$UserRoleAssignmentPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one UserRoleAssignment.
     * @param {UserRoleAssignmentUpdateArgs} args - Arguments to update one UserRoleAssignment.
     * @example
     * // Update one UserRoleAssignment
     * const userRoleAssignment = await prisma.userRoleAssignment.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends UserRoleAssignmentUpdateArgs>(args: SelectSubset<T, UserRoleAssignmentUpdateArgs<ExtArgs>>): Prisma__UserRoleAssignmentClient<$Result.GetResult<Prisma.$UserRoleAssignmentPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more UserRoleAssignments.
     * @param {UserRoleAssignmentDeleteManyArgs} args - Arguments to filter UserRoleAssignments to delete.
     * @example
     * // Delete a few UserRoleAssignments
     * const { count } = await prisma.userRoleAssignment.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends UserRoleAssignmentDeleteManyArgs>(args?: SelectSubset<T, UserRoleAssignmentDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more UserRoleAssignments.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserRoleAssignmentUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many UserRoleAssignments
     * const userRoleAssignment = await prisma.userRoleAssignment.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends UserRoleAssignmentUpdateManyArgs>(args: SelectSubset<T, UserRoleAssignmentUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more UserRoleAssignments and returns the data updated in the database.
     * @param {UserRoleAssignmentUpdateManyAndReturnArgs} args - Arguments to update many UserRoleAssignments.
     * @example
     * // Update many UserRoleAssignments
     * const userRoleAssignment = await prisma.userRoleAssignment.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more UserRoleAssignments and only return the `id`
     * const userRoleAssignmentWithIdOnly = await prisma.userRoleAssignment.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends UserRoleAssignmentUpdateManyAndReturnArgs>(args: SelectSubset<T, UserRoleAssignmentUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserRoleAssignmentPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one UserRoleAssignment.
     * @param {UserRoleAssignmentUpsertArgs} args - Arguments to update or create a UserRoleAssignment.
     * @example
     * // Update or create a UserRoleAssignment
     * const userRoleAssignment = await prisma.userRoleAssignment.upsert({
     *   create: {
     *     // ... data to create a UserRoleAssignment
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the UserRoleAssignment we want to update
     *   }
     * })
     */
    upsert<T extends UserRoleAssignmentUpsertArgs>(args: SelectSubset<T, UserRoleAssignmentUpsertArgs<ExtArgs>>): Prisma__UserRoleAssignmentClient<$Result.GetResult<Prisma.$UserRoleAssignmentPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of UserRoleAssignments.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserRoleAssignmentCountArgs} args - Arguments to filter UserRoleAssignments to count.
     * @example
     * // Count the number of UserRoleAssignments
     * const count = await prisma.userRoleAssignment.count({
     *   where: {
     *     // ... the filter for the UserRoleAssignments we want to count
     *   }
     * })
    **/
    count<T extends UserRoleAssignmentCountArgs>(
      args?: Subset<T, UserRoleAssignmentCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UserRoleAssignmentCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a UserRoleAssignment.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserRoleAssignmentAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends UserRoleAssignmentAggregateArgs>(args: Subset<T, UserRoleAssignmentAggregateArgs>): Prisma.PrismaPromise<GetUserRoleAssignmentAggregateType<T>>

    /**
     * Group by UserRoleAssignment.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserRoleAssignmentGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends UserRoleAssignmentGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UserRoleAssignmentGroupByArgs['orderBy'] }
        : { orderBy?: UserRoleAssignmentGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, UserRoleAssignmentGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUserRoleAssignmentGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the UserRoleAssignment model
   */
  readonly fields: UserRoleAssignmentFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for UserRoleAssignment.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__UserRoleAssignmentClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    assignedByUser<T extends UserRoleAssignment$assignedByUserArgs<ExtArgs> = {}>(args?: Subset<T, UserRoleAssignment$assignedByUserArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the UserRoleAssignment model
   */
  interface UserRoleAssignmentFieldRefs {
    readonly id: FieldRef<"UserRoleAssignment", 'String'>
    readonly userId: FieldRef<"UserRoleAssignment", 'String'>
    readonly role: FieldRef<"UserRoleAssignment", 'UserRole'>
    readonly isPrimary: FieldRef<"UserRoleAssignment", 'Boolean'>
    readonly assignedBy: FieldRef<"UserRoleAssignment", 'String'>
    readonly createdAt: FieldRef<"UserRoleAssignment", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * UserRoleAssignment findUnique
   */
  export type UserRoleAssignmentFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserRoleAssignment
     */
    select?: UserRoleAssignmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserRoleAssignment
     */
    omit?: UserRoleAssignmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserRoleAssignmentInclude<ExtArgs> | null
    /**
     * Filter, which UserRoleAssignment to fetch.
     */
    where: UserRoleAssignmentWhereUniqueInput
  }

  /**
   * UserRoleAssignment findUniqueOrThrow
   */
  export type UserRoleAssignmentFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserRoleAssignment
     */
    select?: UserRoleAssignmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserRoleAssignment
     */
    omit?: UserRoleAssignmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserRoleAssignmentInclude<ExtArgs> | null
    /**
     * Filter, which UserRoleAssignment to fetch.
     */
    where: UserRoleAssignmentWhereUniqueInput
  }

  /**
   * UserRoleAssignment findFirst
   */
  export type UserRoleAssignmentFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserRoleAssignment
     */
    select?: UserRoleAssignmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserRoleAssignment
     */
    omit?: UserRoleAssignmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserRoleAssignmentInclude<ExtArgs> | null
    /**
     * Filter, which UserRoleAssignment to fetch.
     */
    where?: UserRoleAssignmentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserRoleAssignments to fetch.
     */
    orderBy?: UserRoleAssignmentOrderByWithRelationInput | UserRoleAssignmentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for UserRoleAssignments.
     */
    cursor?: UserRoleAssignmentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserRoleAssignments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserRoleAssignments.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of UserRoleAssignments.
     */
    distinct?: UserRoleAssignmentScalarFieldEnum | UserRoleAssignmentScalarFieldEnum[]
  }

  /**
   * UserRoleAssignment findFirstOrThrow
   */
  export type UserRoleAssignmentFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserRoleAssignment
     */
    select?: UserRoleAssignmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserRoleAssignment
     */
    omit?: UserRoleAssignmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserRoleAssignmentInclude<ExtArgs> | null
    /**
     * Filter, which UserRoleAssignment to fetch.
     */
    where?: UserRoleAssignmentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserRoleAssignments to fetch.
     */
    orderBy?: UserRoleAssignmentOrderByWithRelationInput | UserRoleAssignmentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for UserRoleAssignments.
     */
    cursor?: UserRoleAssignmentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserRoleAssignments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserRoleAssignments.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of UserRoleAssignments.
     */
    distinct?: UserRoleAssignmentScalarFieldEnum | UserRoleAssignmentScalarFieldEnum[]
  }

  /**
   * UserRoleAssignment findMany
   */
  export type UserRoleAssignmentFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserRoleAssignment
     */
    select?: UserRoleAssignmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserRoleAssignment
     */
    omit?: UserRoleAssignmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserRoleAssignmentInclude<ExtArgs> | null
    /**
     * Filter, which UserRoleAssignments to fetch.
     */
    where?: UserRoleAssignmentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserRoleAssignments to fetch.
     */
    orderBy?: UserRoleAssignmentOrderByWithRelationInput | UserRoleAssignmentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing UserRoleAssignments.
     */
    cursor?: UserRoleAssignmentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserRoleAssignments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserRoleAssignments.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of UserRoleAssignments.
     */
    distinct?: UserRoleAssignmentScalarFieldEnum | UserRoleAssignmentScalarFieldEnum[]
  }

  /**
   * UserRoleAssignment create
   */
  export type UserRoleAssignmentCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserRoleAssignment
     */
    select?: UserRoleAssignmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserRoleAssignment
     */
    omit?: UserRoleAssignmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserRoleAssignmentInclude<ExtArgs> | null
    /**
     * The data needed to create a UserRoleAssignment.
     */
    data: XOR<UserRoleAssignmentCreateInput, UserRoleAssignmentUncheckedCreateInput>
  }

  /**
   * UserRoleAssignment createMany
   */
  export type UserRoleAssignmentCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many UserRoleAssignments.
     */
    data: UserRoleAssignmentCreateManyInput | UserRoleAssignmentCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * UserRoleAssignment createManyAndReturn
   */
  export type UserRoleAssignmentCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserRoleAssignment
     */
    select?: UserRoleAssignmentSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the UserRoleAssignment
     */
    omit?: UserRoleAssignmentOmit<ExtArgs> | null
    /**
     * The data used to create many UserRoleAssignments.
     */
    data: UserRoleAssignmentCreateManyInput | UserRoleAssignmentCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserRoleAssignmentIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * UserRoleAssignment update
   */
  export type UserRoleAssignmentUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserRoleAssignment
     */
    select?: UserRoleAssignmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserRoleAssignment
     */
    omit?: UserRoleAssignmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserRoleAssignmentInclude<ExtArgs> | null
    /**
     * The data needed to update a UserRoleAssignment.
     */
    data: XOR<UserRoleAssignmentUpdateInput, UserRoleAssignmentUncheckedUpdateInput>
    /**
     * Choose, which UserRoleAssignment to update.
     */
    where: UserRoleAssignmentWhereUniqueInput
  }

  /**
   * UserRoleAssignment updateMany
   */
  export type UserRoleAssignmentUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update UserRoleAssignments.
     */
    data: XOR<UserRoleAssignmentUpdateManyMutationInput, UserRoleAssignmentUncheckedUpdateManyInput>
    /**
     * Filter which UserRoleAssignments to update
     */
    where?: UserRoleAssignmentWhereInput
    /**
     * Limit how many UserRoleAssignments to update.
     */
    limit?: number
  }

  /**
   * UserRoleAssignment updateManyAndReturn
   */
  export type UserRoleAssignmentUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserRoleAssignment
     */
    select?: UserRoleAssignmentSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the UserRoleAssignment
     */
    omit?: UserRoleAssignmentOmit<ExtArgs> | null
    /**
     * The data used to update UserRoleAssignments.
     */
    data: XOR<UserRoleAssignmentUpdateManyMutationInput, UserRoleAssignmentUncheckedUpdateManyInput>
    /**
     * Filter which UserRoleAssignments to update
     */
    where?: UserRoleAssignmentWhereInput
    /**
     * Limit how many UserRoleAssignments to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserRoleAssignmentIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * UserRoleAssignment upsert
   */
  export type UserRoleAssignmentUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserRoleAssignment
     */
    select?: UserRoleAssignmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserRoleAssignment
     */
    omit?: UserRoleAssignmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserRoleAssignmentInclude<ExtArgs> | null
    /**
     * The filter to search for the UserRoleAssignment to update in case it exists.
     */
    where: UserRoleAssignmentWhereUniqueInput
    /**
     * In case the UserRoleAssignment found by the `where` argument doesn't exist, create a new UserRoleAssignment with this data.
     */
    create: XOR<UserRoleAssignmentCreateInput, UserRoleAssignmentUncheckedCreateInput>
    /**
     * In case the UserRoleAssignment was found with the provided `where` argument, update it with this data.
     */
    update: XOR<UserRoleAssignmentUpdateInput, UserRoleAssignmentUncheckedUpdateInput>
  }

  /**
   * UserRoleAssignment delete
   */
  export type UserRoleAssignmentDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserRoleAssignment
     */
    select?: UserRoleAssignmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserRoleAssignment
     */
    omit?: UserRoleAssignmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserRoleAssignmentInclude<ExtArgs> | null
    /**
     * Filter which UserRoleAssignment to delete.
     */
    where: UserRoleAssignmentWhereUniqueInput
  }

  /**
   * UserRoleAssignment deleteMany
   */
  export type UserRoleAssignmentDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which UserRoleAssignments to delete
     */
    where?: UserRoleAssignmentWhereInput
    /**
     * Limit how many UserRoleAssignments to delete.
     */
    limit?: number
  }

  /**
   * UserRoleAssignment.assignedByUser
   */
  export type UserRoleAssignment$assignedByUserArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    where?: UserWhereInput
  }

  /**
   * UserRoleAssignment without action
   */
  export type UserRoleAssignmentDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserRoleAssignment
     */
    select?: UserRoleAssignmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserRoleAssignment
     */
    omit?: UserRoleAssignmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserRoleAssignmentInclude<ExtArgs> | null
  }


  /**
   * Model AuthToken
   */

  export type AggregateAuthToken = {
    _count: AuthTokenCountAggregateOutputType | null
    _min: AuthTokenMinAggregateOutputType | null
    _max: AuthTokenMaxAggregateOutputType | null
  }

  export type AuthTokenMinAggregateOutputType = {
    id: string | null
    userId: string | null
    tokenHash: string | null
    tokenType: $Enums.AuthTokenType | null
    target: string | null
    expiresAt: Date | null
    usedAt: Date | null
    createdAt: Date | null
  }

  export type AuthTokenMaxAggregateOutputType = {
    id: string | null
    userId: string | null
    tokenHash: string | null
    tokenType: $Enums.AuthTokenType | null
    target: string | null
    expiresAt: Date | null
    usedAt: Date | null
    createdAt: Date | null
  }

  export type AuthTokenCountAggregateOutputType = {
    id: number
    userId: number
    tokenHash: number
    tokenType: number
    target: number
    expiresAt: number
    usedAt: number
    createdAt: number
    _all: number
  }


  export type AuthTokenMinAggregateInputType = {
    id?: true
    userId?: true
    tokenHash?: true
    tokenType?: true
    target?: true
    expiresAt?: true
    usedAt?: true
    createdAt?: true
  }

  export type AuthTokenMaxAggregateInputType = {
    id?: true
    userId?: true
    tokenHash?: true
    tokenType?: true
    target?: true
    expiresAt?: true
    usedAt?: true
    createdAt?: true
  }

  export type AuthTokenCountAggregateInputType = {
    id?: true
    userId?: true
    tokenHash?: true
    tokenType?: true
    target?: true
    expiresAt?: true
    usedAt?: true
    createdAt?: true
    _all?: true
  }

  export type AuthTokenAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which AuthToken to aggregate.
     */
    where?: AuthTokenWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AuthTokens to fetch.
     */
    orderBy?: AuthTokenOrderByWithRelationInput | AuthTokenOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: AuthTokenWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AuthTokens from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AuthTokens.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned AuthTokens
    **/
    _count?: true | AuthTokenCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: AuthTokenMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: AuthTokenMaxAggregateInputType
  }

  export type GetAuthTokenAggregateType<T extends AuthTokenAggregateArgs> = {
        [P in keyof T & keyof AggregateAuthToken]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateAuthToken[P]>
      : GetScalarType<T[P], AggregateAuthToken[P]>
  }




  export type AuthTokenGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: AuthTokenWhereInput
    orderBy?: AuthTokenOrderByWithAggregationInput | AuthTokenOrderByWithAggregationInput[]
    by: AuthTokenScalarFieldEnum[] | AuthTokenScalarFieldEnum
    having?: AuthTokenScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: AuthTokenCountAggregateInputType | true
    _min?: AuthTokenMinAggregateInputType
    _max?: AuthTokenMaxAggregateInputType
  }

  export type AuthTokenGroupByOutputType = {
    id: string
    userId: string
    tokenHash: string
    tokenType: $Enums.AuthTokenType
    target: string
    expiresAt: Date
    usedAt: Date | null
    createdAt: Date
    _count: AuthTokenCountAggregateOutputType | null
    _min: AuthTokenMinAggregateOutputType | null
    _max: AuthTokenMaxAggregateOutputType | null
  }

  type GetAuthTokenGroupByPayload<T extends AuthTokenGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<AuthTokenGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof AuthTokenGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], AuthTokenGroupByOutputType[P]>
            : GetScalarType<T[P], AuthTokenGroupByOutputType[P]>
        }
      >
    >


  export type AuthTokenSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    tokenHash?: boolean
    tokenType?: boolean
    target?: boolean
    expiresAt?: boolean
    usedAt?: boolean
    createdAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["authToken"]>

  export type AuthTokenSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    tokenHash?: boolean
    tokenType?: boolean
    target?: boolean
    expiresAt?: boolean
    usedAt?: boolean
    createdAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["authToken"]>

  export type AuthTokenSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    tokenHash?: boolean
    tokenType?: boolean
    target?: boolean
    expiresAt?: boolean
    usedAt?: boolean
    createdAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["authToken"]>

  export type AuthTokenSelectScalar = {
    id?: boolean
    userId?: boolean
    tokenHash?: boolean
    tokenType?: boolean
    target?: boolean
    expiresAt?: boolean
    usedAt?: boolean
    createdAt?: boolean
  }

  export type AuthTokenOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "userId" | "tokenHash" | "tokenType" | "target" | "expiresAt" | "usedAt" | "createdAt", ExtArgs["result"]["authToken"]>
  export type AuthTokenInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type AuthTokenIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type AuthTokenIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $AuthTokenPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "AuthToken"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      userId: string
      tokenHash: string
      tokenType: $Enums.AuthTokenType
      target: string
      expiresAt: Date
      usedAt: Date | null
      createdAt: Date
    }, ExtArgs["result"]["authToken"]>
    composites: {}
  }

  type AuthTokenGetPayload<S extends boolean | null | undefined | AuthTokenDefaultArgs> = $Result.GetResult<Prisma.$AuthTokenPayload, S>

  type AuthTokenCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<AuthTokenFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: AuthTokenCountAggregateInputType | true
    }

  export interface AuthTokenDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['AuthToken'], meta: { name: 'AuthToken' } }
    /**
     * Find zero or one AuthToken that matches the filter.
     * @param {AuthTokenFindUniqueArgs} args - Arguments to find a AuthToken
     * @example
     * // Get one AuthToken
     * const authToken = await prisma.authToken.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends AuthTokenFindUniqueArgs>(args: SelectSubset<T, AuthTokenFindUniqueArgs<ExtArgs>>): Prisma__AuthTokenClient<$Result.GetResult<Prisma.$AuthTokenPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one AuthToken that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {AuthTokenFindUniqueOrThrowArgs} args - Arguments to find a AuthToken
     * @example
     * // Get one AuthToken
     * const authToken = await prisma.authToken.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends AuthTokenFindUniqueOrThrowArgs>(args: SelectSubset<T, AuthTokenFindUniqueOrThrowArgs<ExtArgs>>): Prisma__AuthTokenClient<$Result.GetResult<Prisma.$AuthTokenPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first AuthToken that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AuthTokenFindFirstArgs} args - Arguments to find a AuthToken
     * @example
     * // Get one AuthToken
     * const authToken = await prisma.authToken.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends AuthTokenFindFirstArgs>(args?: SelectSubset<T, AuthTokenFindFirstArgs<ExtArgs>>): Prisma__AuthTokenClient<$Result.GetResult<Prisma.$AuthTokenPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first AuthToken that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AuthTokenFindFirstOrThrowArgs} args - Arguments to find a AuthToken
     * @example
     * // Get one AuthToken
     * const authToken = await prisma.authToken.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends AuthTokenFindFirstOrThrowArgs>(args?: SelectSubset<T, AuthTokenFindFirstOrThrowArgs<ExtArgs>>): Prisma__AuthTokenClient<$Result.GetResult<Prisma.$AuthTokenPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more AuthTokens that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AuthTokenFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all AuthTokens
     * const authTokens = await prisma.authToken.findMany()
     * 
     * // Get first 10 AuthTokens
     * const authTokens = await prisma.authToken.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const authTokenWithIdOnly = await prisma.authToken.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends AuthTokenFindManyArgs>(args?: SelectSubset<T, AuthTokenFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AuthTokenPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a AuthToken.
     * @param {AuthTokenCreateArgs} args - Arguments to create a AuthToken.
     * @example
     * // Create one AuthToken
     * const AuthToken = await prisma.authToken.create({
     *   data: {
     *     // ... data to create a AuthToken
     *   }
     * })
     * 
     */
    create<T extends AuthTokenCreateArgs>(args: SelectSubset<T, AuthTokenCreateArgs<ExtArgs>>): Prisma__AuthTokenClient<$Result.GetResult<Prisma.$AuthTokenPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many AuthTokens.
     * @param {AuthTokenCreateManyArgs} args - Arguments to create many AuthTokens.
     * @example
     * // Create many AuthTokens
     * const authToken = await prisma.authToken.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends AuthTokenCreateManyArgs>(args?: SelectSubset<T, AuthTokenCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many AuthTokens and returns the data saved in the database.
     * @param {AuthTokenCreateManyAndReturnArgs} args - Arguments to create many AuthTokens.
     * @example
     * // Create many AuthTokens
     * const authToken = await prisma.authToken.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many AuthTokens and only return the `id`
     * const authTokenWithIdOnly = await prisma.authToken.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends AuthTokenCreateManyAndReturnArgs>(args?: SelectSubset<T, AuthTokenCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AuthTokenPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a AuthToken.
     * @param {AuthTokenDeleteArgs} args - Arguments to delete one AuthToken.
     * @example
     * // Delete one AuthToken
     * const AuthToken = await prisma.authToken.delete({
     *   where: {
     *     // ... filter to delete one AuthToken
     *   }
     * })
     * 
     */
    delete<T extends AuthTokenDeleteArgs>(args: SelectSubset<T, AuthTokenDeleteArgs<ExtArgs>>): Prisma__AuthTokenClient<$Result.GetResult<Prisma.$AuthTokenPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one AuthToken.
     * @param {AuthTokenUpdateArgs} args - Arguments to update one AuthToken.
     * @example
     * // Update one AuthToken
     * const authToken = await prisma.authToken.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends AuthTokenUpdateArgs>(args: SelectSubset<T, AuthTokenUpdateArgs<ExtArgs>>): Prisma__AuthTokenClient<$Result.GetResult<Prisma.$AuthTokenPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more AuthTokens.
     * @param {AuthTokenDeleteManyArgs} args - Arguments to filter AuthTokens to delete.
     * @example
     * // Delete a few AuthTokens
     * const { count } = await prisma.authToken.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends AuthTokenDeleteManyArgs>(args?: SelectSubset<T, AuthTokenDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more AuthTokens.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AuthTokenUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many AuthTokens
     * const authToken = await prisma.authToken.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends AuthTokenUpdateManyArgs>(args: SelectSubset<T, AuthTokenUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more AuthTokens and returns the data updated in the database.
     * @param {AuthTokenUpdateManyAndReturnArgs} args - Arguments to update many AuthTokens.
     * @example
     * // Update many AuthTokens
     * const authToken = await prisma.authToken.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more AuthTokens and only return the `id`
     * const authTokenWithIdOnly = await prisma.authToken.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends AuthTokenUpdateManyAndReturnArgs>(args: SelectSubset<T, AuthTokenUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AuthTokenPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one AuthToken.
     * @param {AuthTokenUpsertArgs} args - Arguments to update or create a AuthToken.
     * @example
     * // Update or create a AuthToken
     * const authToken = await prisma.authToken.upsert({
     *   create: {
     *     // ... data to create a AuthToken
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the AuthToken we want to update
     *   }
     * })
     */
    upsert<T extends AuthTokenUpsertArgs>(args: SelectSubset<T, AuthTokenUpsertArgs<ExtArgs>>): Prisma__AuthTokenClient<$Result.GetResult<Prisma.$AuthTokenPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of AuthTokens.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AuthTokenCountArgs} args - Arguments to filter AuthTokens to count.
     * @example
     * // Count the number of AuthTokens
     * const count = await prisma.authToken.count({
     *   where: {
     *     // ... the filter for the AuthTokens we want to count
     *   }
     * })
    **/
    count<T extends AuthTokenCountArgs>(
      args?: Subset<T, AuthTokenCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], AuthTokenCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a AuthToken.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AuthTokenAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends AuthTokenAggregateArgs>(args: Subset<T, AuthTokenAggregateArgs>): Prisma.PrismaPromise<GetAuthTokenAggregateType<T>>

    /**
     * Group by AuthToken.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AuthTokenGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends AuthTokenGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: AuthTokenGroupByArgs['orderBy'] }
        : { orderBy?: AuthTokenGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, AuthTokenGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetAuthTokenGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the AuthToken model
   */
  readonly fields: AuthTokenFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for AuthToken.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__AuthTokenClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the AuthToken model
   */
  interface AuthTokenFieldRefs {
    readonly id: FieldRef<"AuthToken", 'String'>
    readonly userId: FieldRef<"AuthToken", 'String'>
    readonly tokenHash: FieldRef<"AuthToken", 'String'>
    readonly tokenType: FieldRef<"AuthToken", 'AuthTokenType'>
    readonly target: FieldRef<"AuthToken", 'String'>
    readonly expiresAt: FieldRef<"AuthToken", 'DateTime'>
    readonly usedAt: FieldRef<"AuthToken", 'DateTime'>
    readonly createdAt: FieldRef<"AuthToken", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * AuthToken findUnique
   */
  export type AuthTokenFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AuthToken
     */
    select?: AuthTokenSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AuthToken
     */
    omit?: AuthTokenOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuthTokenInclude<ExtArgs> | null
    /**
     * Filter, which AuthToken to fetch.
     */
    where: AuthTokenWhereUniqueInput
  }

  /**
   * AuthToken findUniqueOrThrow
   */
  export type AuthTokenFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AuthToken
     */
    select?: AuthTokenSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AuthToken
     */
    omit?: AuthTokenOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuthTokenInclude<ExtArgs> | null
    /**
     * Filter, which AuthToken to fetch.
     */
    where: AuthTokenWhereUniqueInput
  }

  /**
   * AuthToken findFirst
   */
  export type AuthTokenFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AuthToken
     */
    select?: AuthTokenSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AuthToken
     */
    omit?: AuthTokenOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuthTokenInclude<ExtArgs> | null
    /**
     * Filter, which AuthToken to fetch.
     */
    where?: AuthTokenWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AuthTokens to fetch.
     */
    orderBy?: AuthTokenOrderByWithRelationInput | AuthTokenOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for AuthTokens.
     */
    cursor?: AuthTokenWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AuthTokens from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AuthTokens.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of AuthTokens.
     */
    distinct?: AuthTokenScalarFieldEnum | AuthTokenScalarFieldEnum[]
  }

  /**
   * AuthToken findFirstOrThrow
   */
  export type AuthTokenFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AuthToken
     */
    select?: AuthTokenSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AuthToken
     */
    omit?: AuthTokenOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuthTokenInclude<ExtArgs> | null
    /**
     * Filter, which AuthToken to fetch.
     */
    where?: AuthTokenWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AuthTokens to fetch.
     */
    orderBy?: AuthTokenOrderByWithRelationInput | AuthTokenOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for AuthTokens.
     */
    cursor?: AuthTokenWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AuthTokens from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AuthTokens.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of AuthTokens.
     */
    distinct?: AuthTokenScalarFieldEnum | AuthTokenScalarFieldEnum[]
  }

  /**
   * AuthToken findMany
   */
  export type AuthTokenFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AuthToken
     */
    select?: AuthTokenSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AuthToken
     */
    omit?: AuthTokenOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuthTokenInclude<ExtArgs> | null
    /**
     * Filter, which AuthTokens to fetch.
     */
    where?: AuthTokenWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AuthTokens to fetch.
     */
    orderBy?: AuthTokenOrderByWithRelationInput | AuthTokenOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing AuthTokens.
     */
    cursor?: AuthTokenWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AuthTokens from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AuthTokens.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of AuthTokens.
     */
    distinct?: AuthTokenScalarFieldEnum | AuthTokenScalarFieldEnum[]
  }

  /**
   * AuthToken create
   */
  export type AuthTokenCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AuthToken
     */
    select?: AuthTokenSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AuthToken
     */
    omit?: AuthTokenOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuthTokenInclude<ExtArgs> | null
    /**
     * The data needed to create a AuthToken.
     */
    data: XOR<AuthTokenCreateInput, AuthTokenUncheckedCreateInput>
  }

  /**
   * AuthToken createMany
   */
  export type AuthTokenCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many AuthTokens.
     */
    data: AuthTokenCreateManyInput | AuthTokenCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * AuthToken createManyAndReturn
   */
  export type AuthTokenCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AuthToken
     */
    select?: AuthTokenSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the AuthToken
     */
    omit?: AuthTokenOmit<ExtArgs> | null
    /**
     * The data used to create many AuthTokens.
     */
    data: AuthTokenCreateManyInput | AuthTokenCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuthTokenIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * AuthToken update
   */
  export type AuthTokenUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AuthToken
     */
    select?: AuthTokenSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AuthToken
     */
    omit?: AuthTokenOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuthTokenInclude<ExtArgs> | null
    /**
     * The data needed to update a AuthToken.
     */
    data: XOR<AuthTokenUpdateInput, AuthTokenUncheckedUpdateInput>
    /**
     * Choose, which AuthToken to update.
     */
    where: AuthTokenWhereUniqueInput
  }

  /**
   * AuthToken updateMany
   */
  export type AuthTokenUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update AuthTokens.
     */
    data: XOR<AuthTokenUpdateManyMutationInput, AuthTokenUncheckedUpdateManyInput>
    /**
     * Filter which AuthTokens to update
     */
    where?: AuthTokenWhereInput
    /**
     * Limit how many AuthTokens to update.
     */
    limit?: number
  }

  /**
   * AuthToken updateManyAndReturn
   */
  export type AuthTokenUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AuthToken
     */
    select?: AuthTokenSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the AuthToken
     */
    omit?: AuthTokenOmit<ExtArgs> | null
    /**
     * The data used to update AuthTokens.
     */
    data: XOR<AuthTokenUpdateManyMutationInput, AuthTokenUncheckedUpdateManyInput>
    /**
     * Filter which AuthTokens to update
     */
    where?: AuthTokenWhereInput
    /**
     * Limit how many AuthTokens to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuthTokenIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * AuthToken upsert
   */
  export type AuthTokenUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AuthToken
     */
    select?: AuthTokenSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AuthToken
     */
    omit?: AuthTokenOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuthTokenInclude<ExtArgs> | null
    /**
     * The filter to search for the AuthToken to update in case it exists.
     */
    where: AuthTokenWhereUniqueInput
    /**
     * In case the AuthToken found by the `where` argument doesn't exist, create a new AuthToken with this data.
     */
    create: XOR<AuthTokenCreateInput, AuthTokenUncheckedCreateInput>
    /**
     * In case the AuthToken was found with the provided `where` argument, update it with this data.
     */
    update: XOR<AuthTokenUpdateInput, AuthTokenUncheckedUpdateInput>
  }

  /**
   * AuthToken delete
   */
  export type AuthTokenDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AuthToken
     */
    select?: AuthTokenSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AuthToken
     */
    omit?: AuthTokenOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuthTokenInclude<ExtArgs> | null
    /**
     * Filter which AuthToken to delete.
     */
    where: AuthTokenWhereUniqueInput
  }

  /**
   * AuthToken deleteMany
   */
  export type AuthTokenDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which AuthTokens to delete
     */
    where?: AuthTokenWhereInput
    /**
     * Limit how many AuthTokens to delete.
     */
    limit?: number
  }

  /**
   * AuthToken without action
   */
  export type AuthTokenDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AuthToken
     */
    select?: AuthTokenSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AuthToken
     */
    omit?: AuthTokenOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AuthTokenInclude<ExtArgs> | null
  }


  /**
   * Model RoleInvitation
   */

  export type AggregateRoleInvitation = {
    _count: RoleInvitationCountAggregateOutputType | null
    _min: RoleInvitationMinAggregateOutputType | null
    _max: RoleInvitationMaxAggregateOutputType | null
  }

  export type RoleInvitationMinAggregateOutputType = {
    id: string | null
    targetEmail: string | null
    targetPhone: string | null
    targetRole: $Enums.RoleInvitationTargetRole | null
    tokenHash: string | null
    invitedBy: string | null
    status: $Enums.RoleInvitationStatus | null
    expiresAt: Date | null
    usedAt: Date | null
    usedByUserId: string | null
    notes: string | null
    createdAt: Date | null
  }

  export type RoleInvitationMaxAggregateOutputType = {
    id: string | null
    targetEmail: string | null
    targetPhone: string | null
    targetRole: $Enums.RoleInvitationTargetRole | null
    tokenHash: string | null
    invitedBy: string | null
    status: $Enums.RoleInvitationStatus | null
    expiresAt: Date | null
    usedAt: Date | null
    usedByUserId: string | null
    notes: string | null
    createdAt: Date | null
  }

  export type RoleInvitationCountAggregateOutputType = {
    id: number
    targetEmail: number
    targetPhone: number
    targetRole: number
    tokenHash: number
    invitedBy: number
    status: number
    expiresAt: number
    usedAt: number
    usedByUserId: number
    notes: number
    createdAt: number
    _all: number
  }


  export type RoleInvitationMinAggregateInputType = {
    id?: true
    targetEmail?: true
    targetPhone?: true
    targetRole?: true
    tokenHash?: true
    invitedBy?: true
    status?: true
    expiresAt?: true
    usedAt?: true
    usedByUserId?: true
    notes?: true
    createdAt?: true
  }

  export type RoleInvitationMaxAggregateInputType = {
    id?: true
    targetEmail?: true
    targetPhone?: true
    targetRole?: true
    tokenHash?: true
    invitedBy?: true
    status?: true
    expiresAt?: true
    usedAt?: true
    usedByUserId?: true
    notes?: true
    createdAt?: true
  }

  export type RoleInvitationCountAggregateInputType = {
    id?: true
    targetEmail?: true
    targetPhone?: true
    targetRole?: true
    tokenHash?: true
    invitedBy?: true
    status?: true
    expiresAt?: true
    usedAt?: true
    usedByUserId?: true
    notes?: true
    createdAt?: true
    _all?: true
  }

  export type RoleInvitationAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which RoleInvitation to aggregate.
     */
    where?: RoleInvitationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RoleInvitations to fetch.
     */
    orderBy?: RoleInvitationOrderByWithRelationInput | RoleInvitationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: RoleInvitationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RoleInvitations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RoleInvitations.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned RoleInvitations
    **/
    _count?: true | RoleInvitationCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: RoleInvitationMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: RoleInvitationMaxAggregateInputType
  }

  export type GetRoleInvitationAggregateType<T extends RoleInvitationAggregateArgs> = {
        [P in keyof T & keyof AggregateRoleInvitation]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateRoleInvitation[P]>
      : GetScalarType<T[P], AggregateRoleInvitation[P]>
  }




  export type RoleInvitationGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: RoleInvitationWhereInput
    orderBy?: RoleInvitationOrderByWithAggregationInput | RoleInvitationOrderByWithAggregationInput[]
    by: RoleInvitationScalarFieldEnum[] | RoleInvitationScalarFieldEnum
    having?: RoleInvitationScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: RoleInvitationCountAggregateInputType | true
    _min?: RoleInvitationMinAggregateInputType
    _max?: RoleInvitationMaxAggregateInputType
  }

  export type RoleInvitationGroupByOutputType = {
    id: string
    targetEmail: string | null
    targetPhone: string | null
    targetRole: $Enums.RoleInvitationTargetRole
    tokenHash: string
    invitedBy: string | null
    status: $Enums.RoleInvitationStatus
    expiresAt: Date
    usedAt: Date | null
    usedByUserId: string | null
    notes: string | null
    createdAt: Date
    _count: RoleInvitationCountAggregateOutputType | null
    _min: RoleInvitationMinAggregateOutputType | null
    _max: RoleInvitationMaxAggregateOutputType | null
  }

  type GetRoleInvitationGroupByPayload<T extends RoleInvitationGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<RoleInvitationGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof RoleInvitationGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], RoleInvitationGroupByOutputType[P]>
            : GetScalarType<T[P], RoleInvitationGroupByOutputType[P]>
        }
      >
    >


  export type RoleInvitationSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    targetEmail?: boolean
    targetPhone?: boolean
    targetRole?: boolean
    tokenHash?: boolean
    invitedBy?: boolean
    status?: boolean
    expiresAt?: boolean
    usedAt?: boolean
    usedByUserId?: boolean
    notes?: boolean
    createdAt?: boolean
    invitedByUser?: boolean | RoleInvitation$invitedByUserArgs<ExtArgs>
    usedByUser?: boolean | RoleInvitation$usedByUserArgs<ExtArgs>
  }, ExtArgs["result"]["roleInvitation"]>

  export type RoleInvitationSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    targetEmail?: boolean
    targetPhone?: boolean
    targetRole?: boolean
    tokenHash?: boolean
    invitedBy?: boolean
    status?: boolean
    expiresAt?: boolean
    usedAt?: boolean
    usedByUserId?: boolean
    notes?: boolean
    createdAt?: boolean
    invitedByUser?: boolean | RoleInvitation$invitedByUserArgs<ExtArgs>
    usedByUser?: boolean | RoleInvitation$usedByUserArgs<ExtArgs>
  }, ExtArgs["result"]["roleInvitation"]>

  export type RoleInvitationSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    targetEmail?: boolean
    targetPhone?: boolean
    targetRole?: boolean
    tokenHash?: boolean
    invitedBy?: boolean
    status?: boolean
    expiresAt?: boolean
    usedAt?: boolean
    usedByUserId?: boolean
    notes?: boolean
    createdAt?: boolean
    invitedByUser?: boolean | RoleInvitation$invitedByUserArgs<ExtArgs>
    usedByUser?: boolean | RoleInvitation$usedByUserArgs<ExtArgs>
  }, ExtArgs["result"]["roleInvitation"]>

  export type RoleInvitationSelectScalar = {
    id?: boolean
    targetEmail?: boolean
    targetPhone?: boolean
    targetRole?: boolean
    tokenHash?: boolean
    invitedBy?: boolean
    status?: boolean
    expiresAt?: boolean
    usedAt?: boolean
    usedByUserId?: boolean
    notes?: boolean
    createdAt?: boolean
  }

  export type RoleInvitationOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "targetEmail" | "targetPhone" | "targetRole" | "tokenHash" | "invitedBy" | "status" | "expiresAt" | "usedAt" | "usedByUserId" | "notes" | "createdAt", ExtArgs["result"]["roleInvitation"]>
  export type RoleInvitationInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    invitedByUser?: boolean | RoleInvitation$invitedByUserArgs<ExtArgs>
    usedByUser?: boolean | RoleInvitation$usedByUserArgs<ExtArgs>
  }
  export type RoleInvitationIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    invitedByUser?: boolean | RoleInvitation$invitedByUserArgs<ExtArgs>
    usedByUser?: boolean | RoleInvitation$usedByUserArgs<ExtArgs>
  }
  export type RoleInvitationIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    invitedByUser?: boolean | RoleInvitation$invitedByUserArgs<ExtArgs>
    usedByUser?: boolean | RoleInvitation$usedByUserArgs<ExtArgs>
  }

  export type $RoleInvitationPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "RoleInvitation"
    objects: {
      invitedByUser: Prisma.$UserPayload<ExtArgs> | null
      usedByUser: Prisma.$UserPayload<ExtArgs> | null
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      targetEmail: string | null
      targetPhone: string | null
      targetRole: $Enums.RoleInvitationTargetRole
      tokenHash: string
      invitedBy: string | null
      status: $Enums.RoleInvitationStatus
      expiresAt: Date
      usedAt: Date | null
      usedByUserId: string | null
      notes: string | null
      createdAt: Date
    }, ExtArgs["result"]["roleInvitation"]>
    composites: {}
  }

  type RoleInvitationGetPayload<S extends boolean | null | undefined | RoleInvitationDefaultArgs> = $Result.GetResult<Prisma.$RoleInvitationPayload, S>

  type RoleInvitationCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<RoleInvitationFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: RoleInvitationCountAggregateInputType | true
    }

  export interface RoleInvitationDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['RoleInvitation'], meta: { name: 'RoleInvitation' } }
    /**
     * Find zero or one RoleInvitation that matches the filter.
     * @param {RoleInvitationFindUniqueArgs} args - Arguments to find a RoleInvitation
     * @example
     * // Get one RoleInvitation
     * const roleInvitation = await prisma.roleInvitation.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends RoleInvitationFindUniqueArgs>(args: SelectSubset<T, RoleInvitationFindUniqueArgs<ExtArgs>>): Prisma__RoleInvitationClient<$Result.GetResult<Prisma.$RoleInvitationPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one RoleInvitation that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {RoleInvitationFindUniqueOrThrowArgs} args - Arguments to find a RoleInvitation
     * @example
     * // Get one RoleInvitation
     * const roleInvitation = await prisma.roleInvitation.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends RoleInvitationFindUniqueOrThrowArgs>(args: SelectSubset<T, RoleInvitationFindUniqueOrThrowArgs<ExtArgs>>): Prisma__RoleInvitationClient<$Result.GetResult<Prisma.$RoleInvitationPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first RoleInvitation that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RoleInvitationFindFirstArgs} args - Arguments to find a RoleInvitation
     * @example
     * // Get one RoleInvitation
     * const roleInvitation = await prisma.roleInvitation.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends RoleInvitationFindFirstArgs>(args?: SelectSubset<T, RoleInvitationFindFirstArgs<ExtArgs>>): Prisma__RoleInvitationClient<$Result.GetResult<Prisma.$RoleInvitationPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first RoleInvitation that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RoleInvitationFindFirstOrThrowArgs} args - Arguments to find a RoleInvitation
     * @example
     * // Get one RoleInvitation
     * const roleInvitation = await prisma.roleInvitation.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends RoleInvitationFindFirstOrThrowArgs>(args?: SelectSubset<T, RoleInvitationFindFirstOrThrowArgs<ExtArgs>>): Prisma__RoleInvitationClient<$Result.GetResult<Prisma.$RoleInvitationPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more RoleInvitations that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RoleInvitationFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all RoleInvitations
     * const roleInvitations = await prisma.roleInvitation.findMany()
     * 
     * // Get first 10 RoleInvitations
     * const roleInvitations = await prisma.roleInvitation.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const roleInvitationWithIdOnly = await prisma.roleInvitation.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends RoleInvitationFindManyArgs>(args?: SelectSubset<T, RoleInvitationFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RoleInvitationPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a RoleInvitation.
     * @param {RoleInvitationCreateArgs} args - Arguments to create a RoleInvitation.
     * @example
     * // Create one RoleInvitation
     * const RoleInvitation = await prisma.roleInvitation.create({
     *   data: {
     *     // ... data to create a RoleInvitation
     *   }
     * })
     * 
     */
    create<T extends RoleInvitationCreateArgs>(args: SelectSubset<T, RoleInvitationCreateArgs<ExtArgs>>): Prisma__RoleInvitationClient<$Result.GetResult<Prisma.$RoleInvitationPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many RoleInvitations.
     * @param {RoleInvitationCreateManyArgs} args - Arguments to create many RoleInvitations.
     * @example
     * // Create many RoleInvitations
     * const roleInvitation = await prisma.roleInvitation.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends RoleInvitationCreateManyArgs>(args?: SelectSubset<T, RoleInvitationCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many RoleInvitations and returns the data saved in the database.
     * @param {RoleInvitationCreateManyAndReturnArgs} args - Arguments to create many RoleInvitations.
     * @example
     * // Create many RoleInvitations
     * const roleInvitation = await prisma.roleInvitation.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many RoleInvitations and only return the `id`
     * const roleInvitationWithIdOnly = await prisma.roleInvitation.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends RoleInvitationCreateManyAndReturnArgs>(args?: SelectSubset<T, RoleInvitationCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RoleInvitationPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a RoleInvitation.
     * @param {RoleInvitationDeleteArgs} args - Arguments to delete one RoleInvitation.
     * @example
     * // Delete one RoleInvitation
     * const RoleInvitation = await prisma.roleInvitation.delete({
     *   where: {
     *     // ... filter to delete one RoleInvitation
     *   }
     * })
     * 
     */
    delete<T extends RoleInvitationDeleteArgs>(args: SelectSubset<T, RoleInvitationDeleteArgs<ExtArgs>>): Prisma__RoleInvitationClient<$Result.GetResult<Prisma.$RoleInvitationPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one RoleInvitation.
     * @param {RoleInvitationUpdateArgs} args - Arguments to update one RoleInvitation.
     * @example
     * // Update one RoleInvitation
     * const roleInvitation = await prisma.roleInvitation.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends RoleInvitationUpdateArgs>(args: SelectSubset<T, RoleInvitationUpdateArgs<ExtArgs>>): Prisma__RoleInvitationClient<$Result.GetResult<Prisma.$RoleInvitationPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more RoleInvitations.
     * @param {RoleInvitationDeleteManyArgs} args - Arguments to filter RoleInvitations to delete.
     * @example
     * // Delete a few RoleInvitations
     * const { count } = await prisma.roleInvitation.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends RoleInvitationDeleteManyArgs>(args?: SelectSubset<T, RoleInvitationDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more RoleInvitations.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RoleInvitationUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many RoleInvitations
     * const roleInvitation = await prisma.roleInvitation.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends RoleInvitationUpdateManyArgs>(args: SelectSubset<T, RoleInvitationUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more RoleInvitations and returns the data updated in the database.
     * @param {RoleInvitationUpdateManyAndReturnArgs} args - Arguments to update many RoleInvitations.
     * @example
     * // Update many RoleInvitations
     * const roleInvitation = await prisma.roleInvitation.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more RoleInvitations and only return the `id`
     * const roleInvitationWithIdOnly = await prisma.roleInvitation.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends RoleInvitationUpdateManyAndReturnArgs>(args: SelectSubset<T, RoleInvitationUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RoleInvitationPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one RoleInvitation.
     * @param {RoleInvitationUpsertArgs} args - Arguments to update or create a RoleInvitation.
     * @example
     * // Update or create a RoleInvitation
     * const roleInvitation = await prisma.roleInvitation.upsert({
     *   create: {
     *     // ... data to create a RoleInvitation
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the RoleInvitation we want to update
     *   }
     * })
     */
    upsert<T extends RoleInvitationUpsertArgs>(args: SelectSubset<T, RoleInvitationUpsertArgs<ExtArgs>>): Prisma__RoleInvitationClient<$Result.GetResult<Prisma.$RoleInvitationPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of RoleInvitations.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RoleInvitationCountArgs} args - Arguments to filter RoleInvitations to count.
     * @example
     * // Count the number of RoleInvitations
     * const count = await prisma.roleInvitation.count({
     *   where: {
     *     // ... the filter for the RoleInvitations we want to count
     *   }
     * })
    **/
    count<T extends RoleInvitationCountArgs>(
      args?: Subset<T, RoleInvitationCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], RoleInvitationCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a RoleInvitation.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RoleInvitationAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends RoleInvitationAggregateArgs>(args: Subset<T, RoleInvitationAggregateArgs>): Prisma.PrismaPromise<GetRoleInvitationAggregateType<T>>

    /**
     * Group by RoleInvitation.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RoleInvitationGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends RoleInvitationGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: RoleInvitationGroupByArgs['orderBy'] }
        : { orderBy?: RoleInvitationGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, RoleInvitationGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetRoleInvitationGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the RoleInvitation model
   */
  readonly fields: RoleInvitationFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for RoleInvitation.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__RoleInvitationClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    invitedByUser<T extends RoleInvitation$invitedByUserArgs<ExtArgs> = {}>(args?: Subset<T, RoleInvitation$invitedByUserArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    usedByUser<T extends RoleInvitation$usedByUserArgs<ExtArgs> = {}>(args?: Subset<T, RoleInvitation$usedByUserArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the RoleInvitation model
   */
  interface RoleInvitationFieldRefs {
    readonly id: FieldRef<"RoleInvitation", 'String'>
    readonly targetEmail: FieldRef<"RoleInvitation", 'String'>
    readonly targetPhone: FieldRef<"RoleInvitation", 'String'>
    readonly targetRole: FieldRef<"RoleInvitation", 'RoleInvitationTargetRole'>
    readonly tokenHash: FieldRef<"RoleInvitation", 'String'>
    readonly invitedBy: FieldRef<"RoleInvitation", 'String'>
    readonly status: FieldRef<"RoleInvitation", 'RoleInvitationStatus'>
    readonly expiresAt: FieldRef<"RoleInvitation", 'DateTime'>
    readonly usedAt: FieldRef<"RoleInvitation", 'DateTime'>
    readonly usedByUserId: FieldRef<"RoleInvitation", 'String'>
    readonly notes: FieldRef<"RoleInvitation", 'String'>
    readonly createdAt: FieldRef<"RoleInvitation", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * RoleInvitation findUnique
   */
  export type RoleInvitationFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RoleInvitation
     */
    select?: RoleInvitationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RoleInvitation
     */
    omit?: RoleInvitationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RoleInvitationInclude<ExtArgs> | null
    /**
     * Filter, which RoleInvitation to fetch.
     */
    where: RoleInvitationWhereUniqueInput
  }

  /**
   * RoleInvitation findUniqueOrThrow
   */
  export type RoleInvitationFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RoleInvitation
     */
    select?: RoleInvitationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RoleInvitation
     */
    omit?: RoleInvitationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RoleInvitationInclude<ExtArgs> | null
    /**
     * Filter, which RoleInvitation to fetch.
     */
    where: RoleInvitationWhereUniqueInput
  }

  /**
   * RoleInvitation findFirst
   */
  export type RoleInvitationFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RoleInvitation
     */
    select?: RoleInvitationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RoleInvitation
     */
    omit?: RoleInvitationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RoleInvitationInclude<ExtArgs> | null
    /**
     * Filter, which RoleInvitation to fetch.
     */
    where?: RoleInvitationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RoleInvitations to fetch.
     */
    orderBy?: RoleInvitationOrderByWithRelationInput | RoleInvitationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for RoleInvitations.
     */
    cursor?: RoleInvitationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RoleInvitations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RoleInvitations.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of RoleInvitations.
     */
    distinct?: RoleInvitationScalarFieldEnum | RoleInvitationScalarFieldEnum[]
  }

  /**
   * RoleInvitation findFirstOrThrow
   */
  export type RoleInvitationFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RoleInvitation
     */
    select?: RoleInvitationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RoleInvitation
     */
    omit?: RoleInvitationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RoleInvitationInclude<ExtArgs> | null
    /**
     * Filter, which RoleInvitation to fetch.
     */
    where?: RoleInvitationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RoleInvitations to fetch.
     */
    orderBy?: RoleInvitationOrderByWithRelationInput | RoleInvitationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for RoleInvitations.
     */
    cursor?: RoleInvitationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RoleInvitations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RoleInvitations.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of RoleInvitations.
     */
    distinct?: RoleInvitationScalarFieldEnum | RoleInvitationScalarFieldEnum[]
  }

  /**
   * RoleInvitation findMany
   */
  export type RoleInvitationFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RoleInvitation
     */
    select?: RoleInvitationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RoleInvitation
     */
    omit?: RoleInvitationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RoleInvitationInclude<ExtArgs> | null
    /**
     * Filter, which RoleInvitations to fetch.
     */
    where?: RoleInvitationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RoleInvitations to fetch.
     */
    orderBy?: RoleInvitationOrderByWithRelationInput | RoleInvitationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing RoleInvitations.
     */
    cursor?: RoleInvitationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RoleInvitations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RoleInvitations.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of RoleInvitations.
     */
    distinct?: RoleInvitationScalarFieldEnum | RoleInvitationScalarFieldEnum[]
  }

  /**
   * RoleInvitation create
   */
  export type RoleInvitationCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RoleInvitation
     */
    select?: RoleInvitationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RoleInvitation
     */
    omit?: RoleInvitationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RoleInvitationInclude<ExtArgs> | null
    /**
     * The data needed to create a RoleInvitation.
     */
    data: XOR<RoleInvitationCreateInput, RoleInvitationUncheckedCreateInput>
  }

  /**
   * RoleInvitation createMany
   */
  export type RoleInvitationCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many RoleInvitations.
     */
    data: RoleInvitationCreateManyInput | RoleInvitationCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * RoleInvitation createManyAndReturn
   */
  export type RoleInvitationCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RoleInvitation
     */
    select?: RoleInvitationSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the RoleInvitation
     */
    omit?: RoleInvitationOmit<ExtArgs> | null
    /**
     * The data used to create many RoleInvitations.
     */
    data: RoleInvitationCreateManyInput | RoleInvitationCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RoleInvitationIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * RoleInvitation update
   */
  export type RoleInvitationUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RoleInvitation
     */
    select?: RoleInvitationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RoleInvitation
     */
    omit?: RoleInvitationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RoleInvitationInclude<ExtArgs> | null
    /**
     * The data needed to update a RoleInvitation.
     */
    data: XOR<RoleInvitationUpdateInput, RoleInvitationUncheckedUpdateInput>
    /**
     * Choose, which RoleInvitation to update.
     */
    where: RoleInvitationWhereUniqueInput
  }

  /**
   * RoleInvitation updateMany
   */
  export type RoleInvitationUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update RoleInvitations.
     */
    data: XOR<RoleInvitationUpdateManyMutationInput, RoleInvitationUncheckedUpdateManyInput>
    /**
     * Filter which RoleInvitations to update
     */
    where?: RoleInvitationWhereInput
    /**
     * Limit how many RoleInvitations to update.
     */
    limit?: number
  }

  /**
   * RoleInvitation updateManyAndReturn
   */
  export type RoleInvitationUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RoleInvitation
     */
    select?: RoleInvitationSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the RoleInvitation
     */
    omit?: RoleInvitationOmit<ExtArgs> | null
    /**
     * The data used to update RoleInvitations.
     */
    data: XOR<RoleInvitationUpdateManyMutationInput, RoleInvitationUncheckedUpdateManyInput>
    /**
     * Filter which RoleInvitations to update
     */
    where?: RoleInvitationWhereInput
    /**
     * Limit how many RoleInvitations to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RoleInvitationIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * RoleInvitation upsert
   */
  export type RoleInvitationUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RoleInvitation
     */
    select?: RoleInvitationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RoleInvitation
     */
    omit?: RoleInvitationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RoleInvitationInclude<ExtArgs> | null
    /**
     * The filter to search for the RoleInvitation to update in case it exists.
     */
    where: RoleInvitationWhereUniqueInput
    /**
     * In case the RoleInvitation found by the `where` argument doesn't exist, create a new RoleInvitation with this data.
     */
    create: XOR<RoleInvitationCreateInput, RoleInvitationUncheckedCreateInput>
    /**
     * In case the RoleInvitation was found with the provided `where` argument, update it with this data.
     */
    update: XOR<RoleInvitationUpdateInput, RoleInvitationUncheckedUpdateInput>
  }

  /**
   * RoleInvitation delete
   */
  export type RoleInvitationDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RoleInvitation
     */
    select?: RoleInvitationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RoleInvitation
     */
    omit?: RoleInvitationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RoleInvitationInclude<ExtArgs> | null
    /**
     * Filter which RoleInvitation to delete.
     */
    where: RoleInvitationWhereUniqueInput
  }

  /**
   * RoleInvitation deleteMany
   */
  export type RoleInvitationDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which RoleInvitations to delete
     */
    where?: RoleInvitationWhereInput
    /**
     * Limit how many RoleInvitations to delete.
     */
    limit?: number
  }

  /**
   * RoleInvitation.invitedByUser
   */
  export type RoleInvitation$invitedByUserArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    where?: UserWhereInput
  }

  /**
   * RoleInvitation.usedByUser
   */
  export type RoleInvitation$usedByUserArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    where?: UserWhereInput
  }

  /**
   * RoleInvitation without action
   */
  export type RoleInvitationDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RoleInvitation
     */
    select?: RoleInvitationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RoleInvitation
     */
    omit?: RoleInvitationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RoleInvitationInclude<ExtArgs> | null
  }


  /**
   * Model LearnerProfile
   */

  export type AggregateLearnerProfile = {
    _count: LearnerProfileCountAggregateOutputType | null
    _min: LearnerProfileMinAggregateOutputType | null
    _max: LearnerProfileMaxAggregateOutputType | null
  }

  export type LearnerProfileMinAggregateOutputType = {
    id: string | null
    userId: string | null
    learnerType: string | null
    bio: string | null
    skillLevel: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type LearnerProfileMaxAggregateOutputType = {
    id: string | null
    userId: string | null
    learnerType: string | null
    bio: string | null
    skillLevel: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type LearnerProfileCountAggregateOutputType = {
    id: number
    userId: number
    learnerType: number
    bio: number
    interests: number
    skillLevel: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type LearnerProfileMinAggregateInputType = {
    id?: true
    userId?: true
    learnerType?: true
    bio?: true
    skillLevel?: true
    createdAt?: true
    updatedAt?: true
  }

  export type LearnerProfileMaxAggregateInputType = {
    id?: true
    userId?: true
    learnerType?: true
    bio?: true
    skillLevel?: true
    createdAt?: true
    updatedAt?: true
  }

  export type LearnerProfileCountAggregateInputType = {
    id?: true
    userId?: true
    learnerType?: true
    bio?: true
    interests?: true
    skillLevel?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type LearnerProfileAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which LearnerProfile to aggregate.
     */
    where?: LearnerProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of LearnerProfiles to fetch.
     */
    orderBy?: LearnerProfileOrderByWithRelationInput | LearnerProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: LearnerProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` LearnerProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` LearnerProfiles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned LearnerProfiles
    **/
    _count?: true | LearnerProfileCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: LearnerProfileMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: LearnerProfileMaxAggregateInputType
  }

  export type GetLearnerProfileAggregateType<T extends LearnerProfileAggregateArgs> = {
        [P in keyof T & keyof AggregateLearnerProfile]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateLearnerProfile[P]>
      : GetScalarType<T[P], AggregateLearnerProfile[P]>
  }




  export type LearnerProfileGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: LearnerProfileWhereInput
    orderBy?: LearnerProfileOrderByWithAggregationInput | LearnerProfileOrderByWithAggregationInput[]
    by: LearnerProfileScalarFieldEnum[] | LearnerProfileScalarFieldEnum
    having?: LearnerProfileScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: LearnerProfileCountAggregateInputType | true
    _min?: LearnerProfileMinAggregateInputType
    _max?: LearnerProfileMaxAggregateInputType
  }

  export type LearnerProfileGroupByOutputType = {
    id: string
    userId: string
    learnerType: string | null
    bio: string | null
    interests: string[]
    skillLevel: string | null
    createdAt: Date
    updatedAt: Date
    _count: LearnerProfileCountAggregateOutputType | null
    _min: LearnerProfileMinAggregateOutputType | null
    _max: LearnerProfileMaxAggregateOutputType | null
  }

  type GetLearnerProfileGroupByPayload<T extends LearnerProfileGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<LearnerProfileGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof LearnerProfileGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], LearnerProfileGroupByOutputType[P]>
            : GetScalarType<T[P], LearnerProfileGroupByOutputType[P]>
        }
      >
    >


  export type LearnerProfileSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    learnerType?: boolean
    bio?: boolean
    interests?: boolean
    skillLevel?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["learnerProfile"]>

  export type LearnerProfileSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    learnerType?: boolean
    bio?: boolean
    interests?: boolean
    skillLevel?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["learnerProfile"]>

  export type LearnerProfileSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    learnerType?: boolean
    bio?: boolean
    interests?: boolean
    skillLevel?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["learnerProfile"]>

  export type LearnerProfileSelectScalar = {
    id?: boolean
    userId?: boolean
    learnerType?: boolean
    bio?: boolean
    interests?: boolean
    skillLevel?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type LearnerProfileOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "userId" | "learnerType" | "bio" | "interests" | "skillLevel" | "createdAt" | "updatedAt", ExtArgs["result"]["learnerProfile"]>
  export type LearnerProfileInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type LearnerProfileIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type LearnerProfileIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $LearnerProfilePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "LearnerProfile"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      userId: string
      learnerType: string | null
      bio: string | null
      interests: string[]
      skillLevel: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["learnerProfile"]>
    composites: {}
  }

  type LearnerProfileGetPayload<S extends boolean | null | undefined | LearnerProfileDefaultArgs> = $Result.GetResult<Prisma.$LearnerProfilePayload, S>

  type LearnerProfileCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<LearnerProfileFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: LearnerProfileCountAggregateInputType | true
    }

  export interface LearnerProfileDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['LearnerProfile'], meta: { name: 'LearnerProfile' } }
    /**
     * Find zero or one LearnerProfile that matches the filter.
     * @param {LearnerProfileFindUniqueArgs} args - Arguments to find a LearnerProfile
     * @example
     * // Get one LearnerProfile
     * const learnerProfile = await prisma.learnerProfile.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends LearnerProfileFindUniqueArgs>(args: SelectSubset<T, LearnerProfileFindUniqueArgs<ExtArgs>>): Prisma__LearnerProfileClient<$Result.GetResult<Prisma.$LearnerProfilePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one LearnerProfile that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {LearnerProfileFindUniqueOrThrowArgs} args - Arguments to find a LearnerProfile
     * @example
     * // Get one LearnerProfile
     * const learnerProfile = await prisma.learnerProfile.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends LearnerProfileFindUniqueOrThrowArgs>(args: SelectSubset<T, LearnerProfileFindUniqueOrThrowArgs<ExtArgs>>): Prisma__LearnerProfileClient<$Result.GetResult<Prisma.$LearnerProfilePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first LearnerProfile that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LearnerProfileFindFirstArgs} args - Arguments to find a LearnerProfile
     * @example
     * // Get one LearnerProfile
     * const learnerProfile = await prisma.learnerProfile.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends LearnerProfileFindFirstArgs>(args?: SelectSubset<T, LearnerProfileFindFirstArgs<ExtArgs>>): Prisma__LearnerProfileClient<$Result.GetResult<Prisma.$LearnerProfilePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first LearnerProfile that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LearnerProfileFindFirstOrThrowArgs} args - Arguments to find a LearnerProfile
     * @example
     * // Get one LearnerProfile
     * const learnerProfile = await prisma.learnerProfile.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends LearnerProfileFindFirstOrThrowArgs>(args?: SelectSubset<T, LearnerProfileFindFirstOrThrowArgs<ExtArgs>>): Prisma__LearnerProfileClient<$Result.GetResult<Prisma.$LearnerProfilePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more LearnerProfiles that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LearnerProfileFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all LearnerProfiles
     * const learnerProfiles = await prisma.learnerProfile.findMany()
     * 
     * // Get first 10 LearnerProfiles
     * const learnerProfiles = await prisma.learnerProfile.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const learnerProfileWithIdOnly = await prisma.learnerProfile.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends LearnerProfileFindManyArgs>(args?: SelectSubset<T, LearnerProfileFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$LearnerProfilePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a LearnerProfile.
     * @param {LearnerProfileCreateArgs} args - Arguments to create a LearnerProfile.
     * @example
     * // Create one LearnerProfile
     * const LearnerProfile = await prisma.learnerProfile.create({
     *   data: {
     *     // ... data to create a LearnerProfile
     *   }
     * })
     * 
     */
    create<T extends LearnerProfileCreateArgs>(args: SelectSubset<T, LearnerProfileCreateArgs<ExtArgs>>): Prisma__LearnerProfileClient<$Result.GetResult<Prisma.$LearnerProfilePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many LearnerProfiles.
     * @param {LearnerProfileCreateManyArgs} args - Arguments to create many LearnerProfiles.
     * @example
     * // Create many LearnerProfiles
     * const learnerProfile = await prisma.learnerProfile.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends LearnerProfileCreateManyArgs>(args?: SelectSubset<T, LearnerProfileCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many LearnerProfiles and returns the data saved in the database.
     * @param {LearnerProfileCreateManyAndReturnArgs} args - Arguments to create many LearnerProfiles.
     * @example
     * // Create many LearnerProfiles
     * const learnerProfile = await prisma.learnerProfile.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many LearnerProfiles and only return the `id`
     * const learnerProfileWithIdOnly = await prisma.learnerProfile.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends LearnerProfileCreateManyAndReturnArgs>(args?: SelectSubset<T, LearnerProfileCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$LearnerProfilePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a LearnerProfile.
     * @param {LearnerProfileDeleteArgs} args - Arguments to delete one LearnerProfile.
     * @example
     * // Delete one LearnerProfile
     * const LearnerProfile = await prisma.learnerProfile.delete({
     *   where: {
     *     // ... filter to delete one LearnerProfile
     *   }
     * })
     * 
     */
    delete<T extends LearnerProfileDeleteArgs>(args: SelectSubset<T, LearnerProfileDeleteArgs<ExtArgs>>): Prisma__LearnerProfileClient<$Result.GetResult<Prisma.$LearnerProfilePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one LearnerProfile.
     * @param {LearnerProfileUpdateArgs} args - Arguments to update one LearnerProfile.
     * @example
     * // Update one LearnerProfile
     * const learnerProfile = await prisma.learnerProfile.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends LearnerProfileUpdateArgs>(args: SelectSubset<T, LearnerProfileUpdateArgs<ExtArgs>>): Prisma__LearnerProfileClient<$Result.GetResult<Prisma.$LearnerProfilePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more LearnerProfiles.
     * @param {LearnerProfileDeleteManyArgs} args - Arguments to filter LearnerProfiles to delete.
     * @example
     * // Delete a few LearnerProfiles
     * const { count } = await prisma.learnerProfile.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends LearnerProfileDeleteManyArgs>(args?: SelectSubset<T, LearnerProfileDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more LearnerProfiles.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LearnerProfileUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many LearnerProfiles
     * const learnerProfile = await prisma.learnerProfile.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends LearnerProfileUpdateManyArgs>(args: SelectSubset<T, LearnerProfileUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more LearnerProfiles and returns the data updated in the database.
     * @param {LearnerProfileUpdateManyAndReturnArgs} args - Arguments to update many LearnerProfiles.
     * @example
     * // Update many LearnerProfiles
     * const learnerProfile = await prisma.learnerProfile.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more LearnerProfiles and only return the `id`
     * const learnerProfileWithIdOnly = await prisma.learnerProfile.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends LearnerProfileUpdateManyAndReturnArgs>(args: SelectSubset<T, LearnerProfileUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$LearnerProfilePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one LearnerProfile.
     * @param {LearnerProfileUpsertArgs} args - Arguments to update or create a LearnerProfile.
     * @example
     * // Update or create a LearnerProfile
     * const learnerProfile = await prisma.learnerProfile.upsert({
     *   create: {
     *     // ... data to create a LearnerProfile
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the LearnerProfile we want to update
     *   }
     * })
     */
    upsert<T extends LearnerProfileUpsertArgs>(args: SelectSubset<T, LearnerProfileUpsertArgs<ExtArgs>>): Prisma__LearnerProfileClient<$Result.GetResult<Prisma.$LearnerProfilePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of LearnerProfiles.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LearnerProfileCountArgs} args - Arguments to filter LearnerProfiles to count.
     * @example
     * // Count the number of LearnerProfiles
     * const count = await prisma.learnerProfile.count({
     *   where: {
     *     // ... the filter for the LearnerProfiles we want to count
     *   }
     * })
    **/
    count<T extends LearnerProfileCountArgs>(
      args?: Subset<T, LearnerProfileCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], LearnerProfileCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a LearnerProfile.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LearnerProfileAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends LearnerProfileAggregateArgs>(args: Subset<T, LearnerProfileAggregateArgs>): Prisma.PrismaPromise<GetLearnerProfileAggregateType<T>>

    /**
     * Group by LearnerProfile.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LearnerProfileGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends LearnerProfileGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: LearnerProfileGroupByArgs['orderBy'] }
        : { orderBy?: LearnerProfileGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, LearnerProfileGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetLearnerProfileGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the LearnerProfile model
   */
  readonly fields: LearnerProfileFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for LearnerProfile.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__LearnerProfileClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the LearnerProfile model
   */
  interface LearnerProfileFieldRefs {
    readonly id: FieldRef<"LearnerProfile", 'String'>
    readonly userId: FieldRef<"LearnerProfile", 'String'>
    readonly learnerType: FieldRef<"LearnerProfile", 'String'>
    readonly bio: FieldRef<"LearnerProfile", 'String'>
    readonly interests: FieldRef<"LearnerProfile", 'String[]'>
    readonly skillLevel: FieldRef<"LearnerProfile", 'String'>
    readonly createdAt: FieldRef<"LearnerProfile", 'DateTime'>
    readonly updatedAt: FieldRef<"LearnerProfile", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * LearnerProfile findUnique
   */
  export type LearnerProfileFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LearnerProfile
     */
    select?: LearnerProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the LearnerProfile
     */
    omit?: LearnerProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LearnerProfileInclude<ExtArgs> | null
    /**
     * Filter, which LearnerProfile to fetch.
     */
    where: LearnerProfileWhereUniqueInput
  }

  /**
   * LearnerProfile findUniqueOrThrow
   */
  export type LearnerProfileFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LearnerProfile
     */
    select?: LearnerProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the LearnerProfile
     */
    omit?: LearnerProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LearnerProfileInclude<ExtArgs> | null
    /**
     * Filter, which LearnerProfile to fetch.
     */
    where: LearnerProfileWhereUniqueInput
  }

  /**
   * LearnerProfile findFirst
   */
  export type LearnerProfileFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LearnerProfile
     */
    select?: LearnerProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the LearnerProfile
     */
    omit?: LearnerProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LearnerProfileInclude<ExtArgs> | null
    /**
     * Filter, which LearnerProfile to fetch.
     */
    where?: LearnerProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of LearnerProfiles to fetch.
     */
    orderBy?: LearnerProfileOrderByWithRelationInput | LearnerProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for LearnerProfiles.
     */
    cursor?: LearnerProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` LearnerProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` LearnerProfiles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of LearnerProfiles.
     */
    distinct?: LearnerProfileScalarFieldEnum | LearnerProfileScalarFieldEnum[]
  }

  /**
   * LearnerProfile findFirstOrThrow
   */
  export type LearnerProfileFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LearnerProfile
     */
    select?: LearnerProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the LearnerProfile
     */
    omit?: LearnerProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LearnerProfileInclude<ExtArgs> | null
    /**
     * Filter, which LearnerProfile to fetch.
     */
    where?: LearnerProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of LearnerProfiles to fetch.
     */
    orderBy?: LearnerProfileOrderByWithRelationInput | LearnerProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for LearnerProfiles.
     */
    cursor?: LearnerProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` LearnerProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` LearnerProfiles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of LearnerProfiles.
     */
    distinct?: LearnerProfileScalarFieldEnum | LearnerProfileScalarFieldEnum[]
  }

  /**
   * LearnerProfile findMany
   */
  export type LearnerProfileFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LearnerProfile
     */
    select?: LearnerProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the LearnerProfile
     */
    omit?: LearnerProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LearnerProfileInclude<ExtArgs> | null
    /**
     * Filter, which LearnerProfiles to fetch.
     */
    where?: LearnerProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of LearnerProfiles to fetch.
     */
    orderBy?: LearnerProfileOrderByWithRelationInput | LearnerProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing LearnerProfiles.
     */
    cursor?: LearnerProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` LearnerProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` LearnerProfiles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of LearnerProfiles.
     */
    distinct?: LearnerProfileScalarFieldEnum | LearnerProfileScalarFieldEnum[]
  }

  /**
   * LearnerProfile create
   */
  export type LearnerProfileCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LearnerProfile
     */
    select?: LearnerProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the LearnerProfile
     */
    omit?: LearnerProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LearnerProfileInclude<ExtArgs> | null
    /**
     * The data needed to create a LearnerProfile.
     */
    data: XOR<LearnerProfileCreateInput, LearnerProfileUncheckedCreateInput>
  }

  /**
   * LearnerProfile createMany
   */
  export type LearnerProfileCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many LearnerProfiles.
     */
    data: LearnerProfileCreateManyInput | LearnerProfileCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * LearnerProfile createManyAndReturn
   */
  export type LearnerProfileCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LearnerProfile
     */
    select?: LearnerProfileSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the LearnerProfile
     */
    omit?: LearnerProfileOmit<ExtArgs> | null
    /**
     * The data used to create many LearnerProfiles.
     */
    data: LearnerProfileCreateManyInput | LearnerProfileCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LearnerProfileIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * LearnerProfile update
   */
  export type LearnerProfileUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LearnerProfile
     */
    select?: LearnerProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the LearnerProfile
     */
    omit?: LearnerProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LearnerProfileInclude<ExtArgs> | null
    /**
     * The data needed to update a LearnerProfile.
     */
    data: XOR<LearnerProfileUpdateInput, LearnerProfileUncheckedUpdateInput>
    /**
     * Choose, which LearnerProfile to update.
     */
    where: LearnerProfileWhereUniqueInput
  }

  /**
   * LearnerProfile updateMany
   */
  export type LearnerProfileUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update LearnerProfiles.
     */
    data: XOR<LearnerProfileUpdateManyMutationInput, LearnerProfileUncheckedUpdateManyInput>
    /**
     * Filter which LearnerProfiles to update
     */
    where?: LearnerProfileWhereInput
    /**
     * Limit how many LearnerProfiles to update.
     */
    limit?: number
  }

  /**
   * LearnerProfile updateManyAndReturn
   */
  export type LearnerProfileUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LearnerProfile
     */
    select?: LearnerProfileSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the LearnerProfile
     */
    omit?: LearnerProfileOmit<ExtArgs> | null
    /**
     * The data used to update LearnerProfiles.
     */
    data: XOR<LearnerProfileUpdateManyMutationInput, LearnerProfileUncheckedUpdateManyInput>
    /**
     * Filter which LearnerProfiles to update
     */
    where?: LearnerProfileWhereInput
    /**
     * Limit how many LearnerProfiles to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LearnerProfileIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * LearnerProfile upsert
   */
  export type LearnerProfileUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LearnerProfile
     */
    select?: LearnerProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the LearnerProfile
     */
    omit?: LearnerProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LearnerProfileInclude<ExtArgs> | null
    /**
     * The filter to search for the LearnerProfile to update in case it exists.
     */
    where: LearnerProfileWhereUniqueInput
    /**
     * In case the LearnerProfile found by the `where` argument doesn't exist, create a new LearnerProfile with this data.
     */
    create: XOR<LearnerProfileCreateInput, LearnerProfileUncheckedCreateInput>
    /**
     * In case the LearnerProfile was found with the provided `where` argument, update it with this data.
     */
    update: XOR<LearnerProfileUpdateInput, LearnerProfileUncheckedUpdateInput>
  }

  /**
   * LearnerProfile delete
   */
  export type LearnerProfileDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LearnerProfile
     */
    select?: LearnerProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the LearnerProfile
     */
    omit?: LearnerProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LearnerProfileInclude<ExtArgs> | null
    /**
     * Filter which LearnerProfile to delete.
     */
    where: LearnerProfileWhereUniqueInput
  }

  /**
   * LearnerProfile deleteMany
   */
  export type LearnerProfileDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which LearnerProfiles to delete
     */
    where?: LearnerProfileWhereInput
    /**
     * Limit how many LearnerProfiles to delete.
     */
    limit?: number
  }

  /**
   * LearnerProfile without action
   */
  export type LearnerProfileDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LearnerProfile
     */
    select?: LearnerProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the LearnerProfile
     */
    omit?: LearnerProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LearnerProfileInclude<ExtArgs> | null
  }


  /**
   * Model SupplierProfile
   */

  export type AggregateSupplierProfile = {
    _count: SupplierProfileCountAggregateOutputType | null
    _min: SupplierProfileMinAggregateOutputType | null
    _max: SupplierProfileMaxAggregateOutputType | null
  }

  export type SupplierProfileMinAggregateOutputType = {
    id: string | null
    userId: string | null
    supplierType: string | null
    publicName: string | null
    description: string | null
    verificationStatus: string | null
    defaultPickupLocationId: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type SupplierProfileMaxAggregateOutputType = {
    id: string | null
    userId: string | null
    supplierType: string | null
    publicName: string | null
    description: string | null
    verificationStatus: string | null
    defaultPickupLocationId: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type SupplierProfileCountAggregateOutputType = {
    id: number
    userId: number
    supplierType: number
    publicName: number
    description: number
    verificationStatus: number
    defaultPickupLocationId: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type SupplierProfileMinAggregateInputType = {
    id?: true
    userId?: true
    supplierType?: true
    publicName?: true
    description?: true
    verificationStatus?: true
    defaultPickupLocationId?: true
    createdAt?: true
    updatedAt?: true
  }

  export type SupplierProfileMaxAggregateInputType = {
    id?: true
    userId?: true
    supplierType?: true
    publicName?: true
    description?: true
    verificationStatus?: true
    defaultPickupLocationId?: true
    createdAt?: true
    updatedAt?: true
  }

  export type SupplierProfileCountAggregateInputType = {
    id?: true
    userId?: true
    supplierType?: true
    publicName?: true
    description?: true
    verificationStatus?: true
    defaultPickupLocationId?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type SupplierProfileAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which SupplierProfile to aggregate.
     */
    where?: SupplierProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SupplierProfiles to fetch.
     */
    orderBy?: SupplierProfileOrderByWithRelationInput | SupplierProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: SupplierProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SupplierProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SupplierProfiles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned SupplierProfiles
    **/
    _count?: true | SupplierProfileCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: SupplierProfileMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: SupplierProfileMaxAggregateInputType
  }

  export type GetSupplierProfileAggregateType<T extends SupplierProfileAggregateArgs> = {
        [P in keyof T & keyof AggregateSupplierProfile]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateSupplierProfile[P]>
      : GetScalarType<T[P], AggregateSupplierProfile[P]>
  }




  export type SupplierProfileGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: SupplierProfileWhereInput
    orderBy?: SupplierProfileOrderByWithAggregationInput | SupplierProfileOrderByWithAggregationInput[]
    by: SupplierProfileScalarFieldEnum[] | SupplierProfileScalarFieldEnum
    having?: SupplierProfileScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: SupplierProfileCountAggregateInputType | true
    _min?: SupplierProfileMinAggregateInputType
    _max?: SupplierProfileMaxAggregateInputType
  }

  export type SupplierProfileGroupByOutputType = {
    id: string
    userId: string
    supplierType: string | null
    publicName: string | null
    description: string | null
    verificationStatus: string
    defaultPickupLocationId: string | null
    createdAt: Date
    updatedAt: Date
    _count: SupplierProfileCountAggregateOutputType | null
    _min: SupplierProfileMinAggregateOutputType | null
    _max: SupplierProfileMaxAggregateOutputType | null
  }

  type GetSupplierProfileGroupByPayload<T extends SupplierProfileGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<SupplierProfileGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof SupplierProfileGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], SupplierProfileGroupByOutputType[P]>
            : GetScalarType<T[P], SupplierProfileGroupByOutputType[P]>
        }
      >
    >


  export type SupplierProfileSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    supplierType?: boolean
    publicName?: boolean
    description?: boolean
    verificationStatus?: boolean
    defaultPickupLocationId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
    defaultPickupLocation?: boolean | SupplierProfile$defaultPickupLocationArgs<ExtArgs>
  }, ExtArgs["result"]["supplierProfile"]>

  export type SupplierProfileSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    supplierType?: boolean
    publicName?: boolean
    description?: boolean
    verificationStatus?: boolean
    defaultPickupLocationId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
    defaultPickupLocation?: boolean | SupplierProfile$defaultPickupLocationArgs<ExtArgs>
  }, ExtArgs["result"]["supplierProfile"]>

  export type SupplierProfileSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    supplierType?: boolean
    publicName?: boolean
    description?: boolean
    verificationStatus?: boolean
    defaultPickupLocationId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
    defaultPickupLocation?: boolean | SupplierProfile$defaultPickupLocationArgs<ExtArgs>
  }, ExtArgs["result"]["supplierProfile"]>

  export type SupplierProfileSelectScalar = {
    id?: boolean
    userId?: boolean
    supplierType?: boolean
    publicName?: boolean
    description?: boolean
    verificationStatus?: boolean
    defaultPickupLocationId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type SupplierProfileOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "userId" | "supplierType" | "publicName" | "description" | "verificationStatus" | "defaultPickupLocationId" | "createdAt" | "updatedAt", ExtArgs["result"]["supplierProfile"]>
  export type SupplierProfileInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
    defaultPickupLocation?: boolean | SupplierProfile$defaultPickupLocationArgs<ExtArgs>
  }
  export type SupplierProfileIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
    defaultPickupLocation?: boolean | SupplierProfile$defaultPickupLocationArgs<ExtArgs>
  }
  export type SupplierProfileIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
    defaultPickupLocation?: boolean | SupplierProfile$defaultPickupLocationArgs<ExtArgs>
  }

  export type $SupplierProfilePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "SupplierProfile"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
      defaultPickupLocation: Prisma.$LocationPayload<ExtArgs> | null
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      userId: string
      supplierType: string | null
      publicName: string | null
      description: string | null
      verificationStatus: string
      defaultPickupLocationId: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["supplierProfile"]>
    composites: {}
  }

  type SupplierProfileGetPayload<S extends boolean | null | undefined | SupplierProfileDefaultArgs> = $Result.GetResult<Prisma.$SupplierProfilePayload, S>

  type SupplierProfileCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<SupplierProfileFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: SupplierProfileCountAggregateInputType | true
    }

  export interface SupplierProfileDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['SupplierProfile'], meta: { name: 'SupplierProfile' } }
    /**
     * Find zero or one SupplierProfile that matches the filter.
     * @param {SupplierProfileFindUniqueArgs} args - Arguments to find a SupplierProfile
     * @example
     * // Get one SupplierProfile
     * const supplierProfile = await prisma.supplierProfile.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends SupplierProfileFindUniqueArgs>(args: SelectSubset<T, SupplierProfileFindUniqueArgs<ExtArgs>>): Prisma__SupplierProfileClient<$Result.GetResult<Prisma.$SupplierProfilePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one SupplierProfile that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {SupplierProfileFindUniqueOrThrowArgs} args - Arguments to find a SupplierProfile
     * @example
     * // Get one SupplierProfile
     * const supplierProfile = await prisma.supplierProfile.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends SupplierProfileFindUniqueOrThrowArgs>(args: SelectSubset<T, SupplierProfileFindUniqueOrThrowArgs<ExtArgs>>): Prisma__SupplierProfileClient<$Result.GetResult<Prisma.$SupplierProfilePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first SupplierProfile that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SupplierProfileFindFirstArgs} args - Arguments to find a SupplierProfile
     * @example
     * // Get one SupplierProfile
     * const supplierProfile = await prisma.supplierProfile.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends SupplierProfileFindFirstArgs>(args?: SelectSubset<T, SupplierProfileFindFirstArgs<ExtArgs>>): Prisma__SupplierProfileClient<$Result.GetResult<Prisma.$SupplierProfilePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first SupplierProfile that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SupplierProfileFindFirstOrThrowArgs} args - Arguments to find a SupplierProfile
     * @example
     * // Get one SupplierProfile
     * const supplierProfile = await prisma.supplierProfile.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends SupplierProfileFindFirstOrThrowArgs>(args?: SelectSubset<T, SupplierProfileFindFirstOrThrowArgs<ExtArgs>>): Prisma__SupplierProfileClient<$Result.GetResult<Prisma.$SupplierProfilePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more SupplierProfiles that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SupplierProfileFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all SupplierProfiles
     * const supplierProfiles = await prisma.supplierProfile.findMany()
     * 
     * // Get first 10 SupplierProfiles
     * const supplierProfiles = await prisma.supplierProfile.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const supplierProfileWithIdOnly = await prisma.supplierProfile.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends SupplierProfileFindManyArgs>(args?: SelectSubset<T, SupplierProfileFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SupplierProfilePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a SupplierProfile.
     * @param {SupplierProfileCreateArgs} args - Arguments to create a SupplierProfile.
     * @example
     * // Create one SupplierProfile
     * const SupplierProfile = await prisma.supplierProfile.create({
     *   data: {
     *     // ... data to create a SupplierProfile
     *   }
     * })
     * 
     */
    create<T extends SupplierProfileCreateArgs>(args: SelectSubset<T, SupplierProfileCreateArgs<ExtArgs>>): Prisma__SupplierProfileClient<$Result.GetResult<Prisma.$SupplierProfilePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many SupplierProfiles.
     * @param {SupplierProfileCreateManyArgs} args - Arguments to create many SupplierProfiles.
     * @example
     * // Create many SupplierProfiles
     * const supplierProfile = await prisma.supplierProfile.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends SupplierProfileCreateManyArgs>(args?: SelectSubset<T, SupplierProfileCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many SupplierProfiles and returns the data saved in the database.
     * @param {SupplierProfileCreateManyAndReturnArgs} args - Arguments to create many SupplierProfiles.
     * @example
     * // Create many SupplierProfiles
     * const supplierProfile = await prisma.supplierProfile.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many SupplierProfiles and only return the `id`
     * const supplierProfileWithIdOnly = await prisma.supplierProfile.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends SupplierProfileCreateManyAndReturnArgs>(args?: SelectSubset<T, SupplierProfileCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SupplierProfilePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a SupplierProfile.
     * @param {SupplierProfileDeleteArgs} args - Arguments to delete one SupplierProfile.
     * @example
     * // Delete one SupplierProfile
     * const SupplierProfile = await prisma.supplierProfile.delete({
     *   where: {
     *     // ... filter to delete one SupplierProfile
     *   }
     * })
     * 
     */
    delete<T extends SupplierProfileDeleteArgs>(args: SelectSubset<T, SupplierProfileDeleteArgs<ExtArgs>>): Prisma__SupplierProfileClient<$Result.GetResult<Prisma.$SupplierProfilePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one SupplierProfile.
     * @param {SupplierProfileUpdateArgs} args - Arguments to update one SupplierProfile.
     * @example
     * // Update one SupplierProfile
     * const supplierProfile = await prisma.supplierProfile.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends SupplierProfileUpdateArgs>(args: SelectSubset<T, SupplierProfileUpdateArgs<ExtArgs>>): Prisma__SupplierProfileClient<$Result.GetResult<Prisma.$SupplierProfilePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more SupplierProfiles.
     * @param {SupplierProfileDeleteManyArgs} args - Arguments to filter SupplierProfiles to delete.
     * @example
     * // Delete a few SupplierProfiles
     * const { count } = await prisma.supplierProfile.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends SupplierProfileDeleteManyArgs>(args?: SelectSubset<T, SupplierProfileDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more SupplierProfiles.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SupplierProfileUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many SupplierProfiles
     * const supplierProfile = await prisma.supplierProfile.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends SupplierProfileUpdateManyArgs>(args: SelectSubset<T, SupplierProfileUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more SupplierProfiles and returns the data updated in the database.
     * @param {SupplierProfileUpdateManyAndReturnArgs} args - Arguments to update many SupplierProfiles.
     * @example
     * // Update many SupplierProfiles
     * const supplierProfile = await prisma.supplierProfile.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more SupplierProfiles and only return the `id`
     * const supplierProfileWithIdOnly = await prisma.supplierProfile.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends SupplierProfileUpdateManyAndReturnArgs>(args: SelectSubset<T, SupplierProfileUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SupplierProfilePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one SupplierProfile.
     * @param {SupplierProfileUpsertArgs} args - Arguments to update or create a SupplierProfile.
     * @example
     * // Update or create a SupplierProfile
     * const supplierProfile = await prisma.supplierProfile.upsert({
     *   create: {
     *     // ... data to create a SupplierProfile
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the SupplierProfile we want to update
     *   }
     * })
     */
    upsert<T extends SupplierProfileUpsertArgs>(args: SelectSubset<T, SupplierProfileUpsertArgs<ExtArgs>>): Prisma__SupplierProfileClient<$Result.GetResult<Prisma.$SupplierProfilePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of SupplierProfiles.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SupplierProfileCountArgs} args - Arguments to filter SupplierProfiles to count.
     * @example
     * // Count the number of SupplierProfiles
     * const count = await prisma.supplierProfile.count({
     *   where: {
     *     // ... the filter for the SupplierProfiles we want to count
     *   }
     * })
    **/
    count<T extends SupplierProfileCountArgs>(
      args?: Subset<T, SupplierProfileCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], SupplierProfileCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a SupplierProfile.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SupplierProfileAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends SupplierProfileAggregateArgs>(args: Subset<T, SupplierProfileAggregateArgs>): Prisma.PrismaPromise<GetSupplierProfileAggregateType<T>>

    /**
     * Group by SupplierProfile.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SupplierProfileGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends SupplierProfileGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: SupplierProfileGroupByArgs['orderBy'] }
        : { orderBy?: SupplierProfileGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, SupplierProfileGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetSupplierProfileGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the SupplierProfile model
   */
  readonly fields: SupplierProfileFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for SupplierProfile.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__SupplierProfileClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    defaultPickupLocation<T extends SupplierProfile$defaultPickupLocationArgs<ExtArgs> = {}>(args?: Subset<T, SupplierProfile$defaultPickupLocationArgs<ExtArgs>>): Prisma__LocationClient<$Result.GetResult<Prisma.$LocationPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the SupplierProfile model
   */
  interface SupplierProfileFieldRefs {
    readonly id: FieldRef<"SupplierProfile", 'String'>
    readonly userId: FieldRef<"SupplierProfile", 'String'>
    readonly supplierType: FieldRef<"SupplierProfile", 'String'>
    readonly publicName: FieldRef<"SupplierProfile", 'String'>
    readonly description: FieldRef<"SupplierProfile", 'String'>
    readonly verificationStatus: FieldRef<"SupplierProfile", 'String'>
    readonly defaultPickupLocationId: FieldRef<"SupplierProfile", 'String'>
    readonly createdAt: FieldRef<"SupplierProfile", 'DateTime'>
    readonly updatedAt: FieldRef<"SupplierProfile", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * SupplierProfile findUnique
   */
  export type SupplierProfileFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SupplierProfile
     */
    select?: SupplierProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SupplierProfile
     */
    omit?: SupplierProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SupplierProfileInclude<ExtArgs> | null
    /**
     * Filter, which SupplierProfile to fetch.
     */
    where: SupplierProfileWhereUniqueInput
  }

  /**
   * SupplierProfile findUniqueOrThrow
   */
  export type SupplierProfileFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SupplierProfile
     */
    select?: SupplierProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SupplierProfile
     */
    omit?: SupplierProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SupplierProfileInclude<ExtArgs> | null
    /**
     * Filter, which SupplierProfile to fetch.
     */
    where: SupplierProfileWhereUniqueInput
  }

  /**
   * SupplierProfile findFirst
   */
  export type SupplierProfileFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SupplierProfile
     */
    select?: SupplierProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SupplierProfile
     */
    omit?: SupplierProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SupplierProfileInclude<ExtArgs> | null
    /**
     * Filter, which SupplierProfile to fetch.
     */
    where?: SupplierProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SupplierProfiles to fetch.
     */
    orderBy?: SupplierProfileOrderByWithRelationInput | SupplierProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for SupplierProfiles.
     */
    cursor?: SupplierProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SupplierProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SupplierProfiles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of SupplierProfiles.
     */
    distinct?: SupplierProfileScalarFieldEnum | SupplierProfileScalarFieldEnum[]
  }

  /**
   * SupplierProfile findFirstOrThrow
   */
  export type SupplierProfileFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SupplierProfile
     */
    select?: SupplierProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SupplierProfile
     */
    omit?: SupplierProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SupplierProfileInclude<ExtArgs> | null
    /**
     * Filter, which SupplierProfile to fetch.
     */
    where?: SupplierProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SupplierProfiles to fetch.
     */
    orderBy?: SupplierProfileOrderByWithRelationInput | SupplierProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for SupplierProfiles.
     */
    cursor?: SupplierProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SupplierProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SupplierProfiles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of SupplierProfiles.
     */
    distinct?: SupplierProfileScalarFieldEnum | SupplierProfileScalarFieldEnum[]
  }

  /**
   * SupplierProfile findMany
   */
  export type SupplierProfileFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SupplierProfile
     */
    select?: SupplierProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SupplierProfile
     */
    omit?: SupplierProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SupplierProfileInclude<ExtArgs> | null
    /**
     * Filter, which SupplierProfiles to fetch.
     */
    where?: SupplierProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SupplierProfiles to fetch.
     */
    orderBy?: SupplierProfileOrderByWithRelationInput | SupplierProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing SupplierProfiles.
     */
    cursor?: SupplierProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SupplierProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SupplierProfiles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of SupplierProfiles.
     */
    distinct?: SupplierProfileScalarFieldEnum | SupplierProfileScalarFieldEnum[]
  }

  /**
   * SupplierProfile create
   */
  export type SupplierProfileCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SupplierProfile
     */
    select?: SupplierProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SupplierProfile
     */
    omit?: SupplierProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SupplierProfileInclude<ExtArgs> | null
    /**
     * The data needed to create a SupplierProfile.
     */
    data: XOR<SupplierProfileCreateInput, SupplierProfileUncheckedCreateInput>
  }

  /**
   * SupplierProfile createMany
   */
  export type SupplierProfileCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many SupplierProfiles.
     */
    data: SupplierProfileCreateManyInput | SupplierProfileCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * SupplierProfile createManyAndReturn
   */
  export type SupplierProfileCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SupplierProfile
     */
    select?: SupplierProfileSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the SupplierProfile
     */
    omit?: SupplierProfileOmit<ExtArgs> | null
    /**
     * The data used to create many SupplierProfiles.
     */
    data: SupplierProfileCreateManyInput | SupplierProfileCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SupplierProfileIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * SupplierProfile update
   */
  export type SupplierProfileUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SupplierProfile
     */
    select?: SupplierProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SupplierProfile
     */
    omit?: SupplierProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SupplierProfileInclude<ExtArgs> | null
    /**
     * The data needed to update a SupplierProfile.
     */
    data: XOR<SupplierProfileUpdateInput, SupplierProfileUncheckedUpdateInput>
    /**
     * Choose, which SupplierProfile to update.
     */
    where: SupplierProfileWhereUniqueInput
  }

  /**
   * SupplierProfile updateMany
   */
  export type SupplierProfileUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update SupplierProfiles.
     */
    data: XOR<SupplierProfileUpdateManyMutationInput, SupplierProfileUncheckedUpdateManyInput>
    /**
     * Filter which SupplierProfiles to update
     */
    where?: SupplierProfileWhereInput
    /**
     * Limit how many SupplierProfiles to update.
     */
    limit?: number
  }

  /**
   * SupplierProfile updateManyAndReturn
   */
  export type SupplierProfileUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SupplierProfile
     */
    select?: SupplierProfileSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the SupplierProfile
     */
    omit?: SupplierProfileOmit<ExtArgs> | null
    /**
     * The data used to update SupplierProfiles.
     */
    data: XOR<SupplierProfileUpdateManyMutationInput, SupplierProfileUncheckedUpdateManyInput>
    /**
     * Filter which SupplierProfiles to update
     */
    where?: SupplierProfileWhereInput
    /**
     * Limit how many SupplierProfiles to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SupplierProfileIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * SupplierProfile upsert
   */
  export type SupplierProfileUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SupplierProfile
     */
    select?: SupplierProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SupplierProfile
     */
    omit?: SupplierProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SupplierProfileInclude<ExtArgs> | null
    /**
     * The filter to search for the SupplierProfile to update in case it exists.
     */
    where: SupplierProfileWhereUniqueInput
    /**
     * In case the SupplierProfile found by the `where` argument doesn't exist, create a new SupplierProfile with this data.
     */
    create: XOR<SupplierProfileCreateInput, SupplierProfileUncheckedCreateInput>
    /**
     * In case the SupplierProfile was found with the provided `where` argument, update it with this data.
     */
    update: XOR<SupplierProfileUpdateInput, SupplierProfileUncheckedUpdateInput>
  }

  /**
   * SupplierProfile delete
   */
  export type SupplierProfileDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SupplierProfile
     */
    select?: SupplierProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SupplierProfile
     */
    omit?: SupplierProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SupplierProfileInclude<ExtArgs> | null
    /**
     * Filter which SupplierProfile to delete.
     */
    where: SupplierProfileWhereUniqueInput
  }

  /**
   * SupplierProfile deleteMany
   */
  export type SupplierProfileDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which SupplierProfiles to delete
     */
    where?: SupplierProfileWhereInput
    /**
     * Limit how many SupplierProfiles to delete.
     */
    limit?: number
  }

  /**
   * SupplierProfile.defaultPickupLocation
   */
  export type SupplierProfile$defaultPickupLocationArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Location
     */
    select?: LocationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Location
     */
    omit?: LocationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocationInclude<ExtArgs> | null
    where?: LocationWhereInput
  }

  /**
   * SupplierProfile without action
   */
  export type SupplierProfileDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SupplierProfile
     */
    select?: SupplierProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SupplierProfile
     */
    omit?: SupplierProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SupplierProfileInclude<ExtArgs> | null
  }


  /**
   * Model Location
   */

  export type AggregateLocation = {
    _count: LocationCountAggregateOutputType | null
    _avg: LocationAvgAggregateOutputType | null
    _sum: LocationSumAggregateOutputType | null
    _min: LocationMinAggregateOutputType | null
    _max: LocationMaxAggregateOutputType | null
  }

  export type LocationAvgAggregateOutputType = {
    latitude: Decimal | null
    longitude: Decimal | null
  }

  export type LocationSumAggregateOutputType = {
    latitude: Decimal | null
    longitude: Decimal | null
  }

  export type LocationMinAggregateOutputType = {
    id: string | null
    country: string | null
    city: string | null
    area: string | null
    addressLine: string | null
    latitude: Decimal | null
    longitude: Decimal | null
    locationType: string | null
    visibility: string | null
    isApproximate: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type LocationMaxAggregateOutputType = {
    id: string | null
    country: string | null
    city: string | null
    area: string | null
    addressLine: string | null
    latitude: Decimal | null
    longitude: Decimal | null
    locationType: string | null
    visibility: string | null
    isApproximate: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type LocationCountAggregateOutputType = {
    id: number
    country: number
    city: number
    area: number
    addressLine: number
    latitude: number
    longitude: number
    locationType: number
    visibility: number
    isApproximate: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type LocationAvgAggregateInputType = {
    latitude?: true
    longitude?: true
  }

  export type LocationSumAggregateInputType = {
    latitude?: true
    longitude?: true
  }

  export type LocationMinAggregateInputType = {
    id?: true
    country?: true
    city?: true
    area?: true
    addressLine?: true
    latitude?: true
    longitude?: true
    locationType?: true
    visibility?: true
    isApproximate?: true
    createdAt?: true
    updatedAt?: true
  }

  export type LocationMaxAggregateInputType = {
    id?: true
    country?: true
    city?: true
    area?: true
    addressLine?: true
    latitude?: true
    longitude?: true
    locationType?: true
    visibility?: true
    isApproximate?: true
    createdAt?: true
    updatedAt?: true
  }

  export type LocationCountAggregateInputType = {
    id?: true
    country?: true
    city?: true
    area?: true
    addressLine?: true
    latitude?: true
    longitude?: true
    locationType?: true
    visibility?: true
    isApproximate?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type LocationAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Location to aggregate.
     */
    where?: LocationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Locations to fetch.
     */
    orderBy?: LocationOrderByWithRelationInput | LocationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: LocationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Locations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Locations.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Locations
    **/
    _count?: true | LocationCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: LocationAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: LocationSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: LocationMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: LocationMaxAggregateInputType
  }

  export type GetLocationAggregateType<T extends LocationAggregateArgs> = {
        [P in keyof T & keyof AggregateLocation]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateLocation[P]>
      : GetScalarType<T[P], AggregateLocation[P]>
  }




  export type LocationGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: LocationWhereInput
    orderBy?: LocationOrderByWithAggregationInput | LocationOrderByWithAggregationInput[]
    by: LocationScalarFieldEnum[] | LocationScalarFieldEnum
    having?: LocationScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: LocationCountAggregateInputType | true
    _avg?: LocationAvgAggregateInputType
    _sum?: LocationSumAggregateInputType
    _min?: LocationMinAggregateInputType
    _max?: LocationMaxAggregateInputType
  }

  export type LocationGroupByOutputType = {
    id: string
    country: string
    city: string
    area: string | null
    addressLine: string | null
    latitude: Decimal | null
    longitude: Decimal | null
    locationType: string | null
    visibility: string | null
    isApproximate: boolean
    createdAt: Date
    updatedAt: Date
    _count: LocationCountAggregateOutputType | null
    _avg: LocationAvgAggregateOutputType | null
    _sum: LocationSumAggregateOutputType | null
    _min: LocationMinAggregateOutputType | null
    _max: LocationMaxAggregateOutputType | null
  }

  type GetLocationGroupByPayload<T extends LocationGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<LocationGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof LocationGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], LocationGroupByOutputType[P]>
            : GetScalarType<T[P], LocationGroupByOutputType[P]>
        }
      >
    >


  export type LocationSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    country?: boolean
    city?: boolean
    area?: boolean
    addressLine?: boolean
    latitude?: boolean
    longitude?: boolean
    locationType?: boolean
    visibility?: boolean
    isApproximate?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    supplierPickupFor?: boolean | Location$supplierPickupForArgs<ExtArgs>
    _count?: boolean | LocationCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["location"]>

  export type LocationSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    country?: boolean
    city?: boolean
    area?: boolean
    addressLine?: boolean
    latitude?: boolean
    longitude?: boolean
    locationType?: boolean
    visibility?: boolean
    isApproximate?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["location"]>

  export type LocationSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    country?: boolean
    city?: boolean
    area?: boolean
    addressLine?: boolean
    latitude?: boolean
    longitude?: boolean
    locationType?: boolean
    visibility?: boolean
    isApproximate?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["location"]>

  export type LocationSelectScalar = {
    id?: boolean
    country?: boolean
    city?: boolean
    area?: boolean
    addressLine?: boolean
    latitude?: boolean
    longitude?: boolean
    locationType?: boolean
    visibility?: boolean
    isApproximate?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type LocationOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "country" | "city" | "area" | "addressLine" | "latitude" | "longitude" | "locationType" | "visibility" | "isApproximate" | "createdAt" | "updatedAt", ExtArgs["result"]["location"]>
  export type LocationInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    supplierPickupFor?: boolean | Location$supplierPickupForArgs<ExtArgs>
    _count?: boolean | LocationCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type LocationIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type LocationIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $LocationPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Location"
    objects: {
      supplierPickupFor: Prisma.$SupplierProfilePayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      country: string
      city: string
      area: string | null
      addressLine: string | null
      latitude: Prisma.Decimal | null
      longitude: Prisma.Decimal | null
      locationType: string | null
      visibility: string | null
      isApproximate: boolean
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["location"]>
    composites: {}
  }

  type LocationGetPayload<S extends boolean | null | undefined | LocationDefaultArgs> = $Result.GetResult<Prisma.$LocationPayload, S>

  type LocationCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<LocationFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: LocationCountAggregateInputType | true
    }

  export interface LocationDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Location'], meta: { name: 'Location' } }
    /**
     * Find zero or one Location that matches the filter.
     * @param {LocationFindUniqueArgs} args - Arguments to find a Location
     * @example
     * // Get one Location
     * const location = await prisma.location.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends LocationFindUniqueArgs>(args: SelectSubset<T, LocationFindUniqueArgs<ExtArgs>>): Prisma__LocationClient<$Result.GetResult<Prisma.$LocationPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Location that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {LocationFindUniqueOrThrowArgs} args - Arguments to find a Location
     * @example
     * // Get one Location
     * const location = await prisma.location.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends LocationFindUniqueOrThrowArgs>(args: SelectSubset<T, LocationFindUniqueOrThrowArgs<ExtArgs>>): Prisma__LocationClient<$Result.GetResult<Prisma.$LocationPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Location that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LocationFindFirstArgs} args - Arguments to find a Location
     * @example
     * // Get one Location
     * const location = await prisma.location.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends LocationFindFirstArgs>(args?: SelectSubset<T, LocationFindFirstArgs<ExtArgs>>): Prisma__LocationClient<$Result.GetResult<Prisma.$LocationPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Location that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LocationFindFirstOrThrowArgs} args - Arguments to find a Location
     * @example
     * // Get one Location
     * const location = await prisma.location.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends LocationFindFirstOrThrowArgs>(args?: SelectSubset<T, LocationFindFirstOrThrowArgs<ExtArgs>>): Prisma__LocationClient<$Result.GetResult<Prisma.$LocationPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Locations that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LocationFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Locations
     * const locations = await prisma.location.findMany()
     * 
     * // Get first 10 Locations
     * const locations = await prisma.location.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const locationWithIdOnly = await prisma.location.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends LocationFindManyArgs>(args?: SelectSubset<T, LocationFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$LocationPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Location.
     * @param {LocationCreateArgs} args - Arguments to create a Location.
     * @example
     * // Create one Location
     * const Location = await prisma.location.create({
     *   data: {
     *     // ... data to create a Location
     *   }
     * })
     * 
     */
    create<T extends LocationCreateArgs>(args: SelectSubset<T, LocationCreateArgs<ExtArgs>>): Prisma__LocationClient<$Result.GetResult<Prisma.$LocationPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Locations.
     * @param {LocationCreateManyArgs} args - Arguments to create many Locations.
     * @example
     * // Create many Locations
     * const location = await prisma.location.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends LocationCreateManyArgs>(args?: SelectSubset<T, LocationCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Locations and returns the data saved in the database.
     * @param {LocationCreateManyAndReturnArgs} args - Arguments to create many Locations.
     * @example
     * // Create many Locations
     * const location = await prisma.location.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Locations and only return the `id`
     * const locationWithIdOnly = await prisma.location.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends LocationCreateManyAndReturnArgs>(args?: SelectSubset<T, LocationCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$LocationPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Location.
     * @param {LocationDeleteArgs} args - Arguments to delete one Location.
     * @example
     * // Delete one Location
     * const Location = await prisma.location.delete({
     *   where: {
     *     // ... filter to delete one Location
     *   }
     * })
     * 
     */
    delete<T extends LocationDeleteArgs>(args: SelectSubset<T, LocationDeleteArgs<ExtArgs>>): Prisma__LocationClient<$Result.GetResult<Prisma.$LocationPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Location.
     * @param {LocationUpdateArgs} args - Arguments to update one Location.
     * @example
     * // Update one Location
     * const location = await prisma.location.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends LocationUpdateArgs>(args: SelectSubset<T, LocationUpdateArgs<ExtArgs>>): Prisma__LocationClient<$Result.GetResult<Prisma.$LocationPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Locations.
     * @param {LocationDeleteManyArgs} args - Arguments to filter Locations to delete.
     * @example
     * // Delete a few Locations
     * const { count } = await prisma.location.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends LocationDeleteManyArgs>(args?: SelectSubset<T, LocationDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Locations.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LocationUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Locations
     * const location = await prisma.location.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends LocationUpdateManyArgs>(args: SelectSubset<T, LocationUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Locations and returns the data updated in the database.
     * @param {LocationUpdateManyAndReturnArgs} args - Arguments to update many Locations.
     * @example
     * // Update many Locations
     * const location = await prisma.location.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Locations and only return the `id`
     * const locationWithIdOnly = await prisma.location.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends LocationUpdateManyAndReturnArgs>(args: SelectSubset<T, LocationUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$LocationPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Location.
     * @param {LocationUpsertArgs} args - Arguments to update or create a Location.
     * @example
     * // Update or create a Location
     * const location = await prisma.location.upsert({
     *   create: {
     *     // ... data to create a Location
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Location we want to update
     *   }
     * })
     */
    upsert<T extends LocationUpsertArgs>(args: SelectSubset<T, LocationUpsertArgs<ExtArgs>>): Prisma__LocationClient<$Result.GetResult<Prisma.$LocationPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Locations.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LocationCountArgs} args - Arguments to filter Locations to count.
     * @example
     * // Count the number of Locations
     * const count = await prisma.location.count({
     *   where: {
     *     // ... the filter for the Locations we want to count
     *   }
     * })
    **/
    count<T extends LocationCountArgs>(
      args?: Subset<T, LocationCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], LocationCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Location.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LocationAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends LocationAggregateArgs>(args: Subset<T, LocationAggregateArgs>): Prisma.PrismaPromise<GetLocationAggregateType<T>>

    /**
     * Group by Location.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LocationGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends LocationGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: LocationGroupByArgs['orderBy'] }
        : { orderBy?: LocationGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, LocationGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetLocationGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Location model
   */
  readonly fields: LocationFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Location.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__LocationClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    supplierPickupFor<T extends Location$supplierPickupForArgs<ExtArgs> = {}>(args?: Subset<T, Location$supplierPickupForArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SupplierProfilePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Location model
   */
  interface LocationFieldRefs {
    readonly id: FieldRef<"Location", 'String'>
    readonly country: FieldRef<"Location", 'String'>
    readonly city: FieldRef<"Location", 'String'>
    readonly area: FieldRef<"Location", 'String'>
    readonly addressLine: FieldRef<"Location", 'String'>
    readonly latitude: FieldRef<"Location", 'Decimal'>
    readonly longitude: FieldRef<"Location", 'Decimal'>
    readonly locationType: FieldRef<"Location", 'String'>
    readonly visibility: FieldRef<"Location", 'String'>
    readonly isApproximate: FieldRef<"Location", 'Boolean'>
    readonly createdAt: FieldRef<"Location", 'DateTime'>
    readonly updatedAt: FieldRef<"Location", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Location findUnique
   */
  export type LocationFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Location
     */
    select?: LocationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Location
     */
    omit?: LocationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocationInclude<ExtArgs> | null
    /**
     * Filter, which Location to fetch.
     */
    where: LocationWhereUniqueInput
  }

  /**
   * Location findUniqueOrThrow
   */
  export type LocationFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Location
     */
    select?: LocationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Location
     */
    omit?: LocationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocationInclude<ExtArgs> | null
    /**
     * Filter, which Location to fetch.
     */
    where: LocationWhereUniqueInput
  }

  /**
   * Location findFirst
   */
  export type LocationFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Location
     */
    select?: LocationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Location
     */
    omit?: LocationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocationInclude<ExtArgs> | null
    /**
     * Filter, which Location to fetch.
     */
    where?: LocationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Locations to fetch.
     */
    orderBy?: LocationOrderByWithRelationInput | LocationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Locations.
     */
    cursor?: LocationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Locations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Locations.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Locations.
     */
    distinct?: LocationScalarFieldEnum | LocationScalarFieldEnum[]
  }

  /**
   * Location findFirstOrThrow
   */
  export type LocationFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Location
     */
    select?: LocationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Location
     */
    omit?: LocationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocationInclude<ExtArgs> | null
    /**
     * Filter, which Location to fetch.
     */
    where?: LocationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Locations to fetch.
     */
    orderBy?: LocationOrderByWithRelationInput | LocationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Locations.
     */
    cursor?: LocationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Locations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Locations.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Locations.
     */
    distinct?: LocationScalarFieldEnum | LocationScalarFieldEnum[]
  }

  /**
   * Location findMany
   */
  export type LocationFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Location
     */
    select?: LocationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Location
     */
    omit?: LocationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocationInclude<ExtArgs> | null
    /**
     * Filter, which Locations to fetch.
     */
    where?: LocationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Locations to fetch.
     */
    orderBy?: LocationOrderByWithRelationInput | LocationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Locations.
     */
    cursor?: LocationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Locations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Locations.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Locations.
     */
    distinct?: LocationScalarFieldEnum | LocationScalarFieldEnum[]
  }

  /**
   * Location create
   */
  export type LocationCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Location
     */
    select?: LocationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Location
     */
    omit?: LocationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocationInclude<ExtArgs> | null
    /**
     * The data needed to create a Location.
     */
    data: XOR<LocationCreateInput, LocationUncheckedCreateInput>
  }

  /**
   * Location createMany
   */
  export type LocationCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Locations.
     */
    data: LocationCreateManyInput | LocationCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Location createManyAndReturn
   */
  export type LocationCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Location
     */
    select?: LocationSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Location
     */
    omit?: LocationOmit<ExtArgs> | null
    /**
     * The data used to create many Locations.
     */
    data: LocationCreateManyInput | LocationCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Location update
   */
  export type LocationUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Location
     */
    select?: LocationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Location
     */
    omit?: LocationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocationInclude<ExtArgs> | null
    /**
     * The data needed to update a Location.
     */
    data: XOR<LocationUpdateInput, LocationUncheckedUpdateInput>
    /**
     * Choose, which Location to update.
     */
    where: LocationWhereUniqueInput
  }

  /**
   * Location updateMany
   */
  export type LocationUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Locations.
     */
    data: XOR<LocationUpdateManyMutationInput, LocationUncheckedUpdateManyInput>
    /**
     * Filter which Locations to update
     */
    where?: LocationWhereInput
    /**
     * Limit how many Locations to update.
     */
    limit?: number
  }

  /**
   * Location updateManyAndReturn
   */
  export type LocationUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Location
     */
    select?: LocationSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Location
     */
    omit?: LocationOmit<ExtArgs> | null
    /**
     * The data used to update Locations.
     */
    data: XOR<LocationUpdateManyMutationInput, LocationUncheckedUpdateManyInput>
    /**
     * Filter which Locations to update
     */
    where?: LocationWhereInput
    /**
     * Limit how many Locations to update.
     */
    limit?: number
  }

  /**
   * Location upsert
   */
  export type LocationUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Location
     */
    select?: LocationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Location
     */
    omit?: LocationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocationInclude<ExtArgs> | null
    /**
     * The filter to search for the Location to update in case it exists.
     */
    where: LocationWhereUniqueInput
    /**
     * In case the Location found by the `where` argument doesn't exist, create a new Location with this data.
     */
    create: XOR<LocationCreateInput, LocationUncheckedCreateInput>
    /**
     * In case the Location was found with the provided `where` argument, update it with this data.
     */
    update: XOR<LocationUpdateInput, LocationUncheckedUpdateInput>
  }

  /**
   * Location delete
   */
  export type LocationDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Location
     */
    select?: LocationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Location
     */
    omit?: LocationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocationInclude<ExtArgs> | null
    /**
     * Filter which Location to delete.
     */
    where: LocationWhereUniqueInput
  }

  /**
   * Location deleteMany
   */
  export type LocationDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Locations to delete
     */
    where?: LocationWhereInput
    /**
     * Limit how many Locations to delete.
     */
    limit?: number
  }

  /**
   * Location.supplierPickupFor
   */
  export type Location$supplierPickupForArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SupplierProfile
     */
    select?: SupplierProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SupplierProfile
     */
    omit?: SupplierProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SupplierProfileInclude<ExtArgs> | null
    where?: SupplierProfileWhereInput
    orderBy?: SupplierProfileOrderByWithRelationInput | SupplierProfileOrderByWithRelationInput[]
    cursor?: SupplierProfileWhereUniqueInput
    take?: number
    skip?: number
    distinct?: SupplierProfileScalarFieldEnum | SupplierProfileScalarFieldEnum[]
  }

  /**
   * Location without action
   */
  export type LocationDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Location
     */
    select?: LocationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Location
     */
    omit?: LocationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LocationInclude<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const UserScalarFieldEnum: {
    id: 'id',
    displayName: 'displayName',
    email: 'email',
    phone: 'phone',
    passwordHash: 'passwordHash',
    accountStatus: 'accountStatus',
    profileImageUrl: 'profileImageUrl',
    emailVerifiedAt: 'emailVerifiedAt',
    phoneVerifiedAt: 'phoneVerifiedAt',
    lastLoginAt: 'lastLoginAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type UserScalarFieldEnum = (typeof UserScalarFieldEnum)[keyof typeof UserScalarFieldEnum]


  export const UserRoleAssignmentScalarFieldEnum: {
    id: 'id',
    userId: 'userId',
    role: 'role',
    isPrimary: 'isPrimary',
    assignedBy: 'assignedBy',
    createdAt: 'createdAt'
  };

  export type UserRoleAssignmentScalarFieldEnum = (typeof UserRoleAssignmentScalarFieldEnum)[keyof typeof UserRoleAssignmentScalarFieldEnum]


  export const AuthTokenScalarFieldEnum: {
    id: 'id',
    userId: 'userId',
    tokenHash: 'tokenHash',
    tokenType: 'tokenType',
    target: 'target',
    expiresAt: 'expiresAt',
    usedAt: 'usedAt',
    createdAt: 'createdAt'
  };

  export type AuthTokenScalarFieldEnum = (typeof AuthTokenScalarFieldEnum)[keyof typeof AuthTokenScalarFieldEnum]


  export const RoleInvitationScalarFieldEnum: {
    id: 'id',
    targetEmail: 'targetEmail',
    targetPhone: 'targetPhone',
    targetRole: 'targetRole',
    tokenHash: 'tokenHash',
    invitedBy: 'invitedBy',
    status: 'status',
    expiresAt: 'expiresAt',
    usedAt: 'usedAt',
    usedByUserId: 'usedByUserId',
    notes: 'notes',
    createdAt: 'createdAt'
  };

  export type RoleInvitationScalarFieldEnum = (typeof RoleInvitationScalarFieldEnum)[keyof typeof RoleInvitationScalarFieldEnum]


  export const LearnerProfileScalarFieldEnum: {
    id: 'id',
    userId: 'userId',
    learnerType: 'learnerType',
    bio: 'bio',
    interests: 'interests',
    skillLevel: 'skillLevel',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type LearnerProfileScalarFieldEnum = (typeof LearnerProfileScalarFieldEnum)[keyof typeof LearnerProfileScalarFieldEnum]


  export const SupplierProfileScalarFieldEnum: {
    id: 'id',
    userId: 'userId',
    supplierType: 'supplierType',
    publicName: 'publicName',
    description: 'description',
    verificationStatus: 'verificationStatus',
    defaultPickupLocationId: 'defaultPickupLocationId',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type SupplierProfileScalarFieldEnum = (typeof SupplierProfileScalarFieldEnum)[keyof typeof SupplierProfileScalarFieldEnum]


  export const LocationScalarFieldEnum: {
    id: 'id',
    country: 'country',
    city: 'city',
    area: 'area',
    addressLine: 'addressLine',
    latitude: 'latitude',
    longitude: 'longitude',
    locationType: 'locationType',
    visibility: 'visibility',
    isApproximate: 'isApproximate',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type LocationScalarFieldEnum = (typeof LocationScalarFieldEnum)[keyof typeof LocationScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  /**
   * Field references
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'AccountStatus'
   */
  export type EnumAccountStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'AccountStatus'>
    


  /**
   * Reference to a field of type 'AccountStatus[]'
   */
  export type ListEnumAccountStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'AccountStatus[]'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'UserRole'
   */
  export type EnumUserRoleFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'UserRole'>
    


  /**
   * Reference to a field of type 'UserRole[]'
   */
  export type ListEnumUserRoleFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'UserRole[]'>
    


  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    


  /**
   * Reference to a field of type 'AuthTokenType'
   */
  export type EnumAuthTokenTypeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'AuthTokenType'>
    


  /**
   * Reference to a field of type 'AuthTokenType[]'
   */
  export type ListEnumAuthTokenTypeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'AuthTokenType[]'>
    


  /**
   * Reference to a field of type 'RoleInvitationTargetRole'
   */
  export type EnumRoleInvitationTargetRoleFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'RoleInvitationTargetRole'>
    


  /**
   * Reference to a field of type 'RoleInvitationTargetRole[]'
   */
  export type ListEnumRoleInvitationTargetRoleFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'RoleInvitationTargetRole[]'>
    


  /**
   * Reference to a field of type 'RoleInvitationStatus'
   */
  export type EnumRoleInvitationStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'RoleInvitationStatus'>
    


  /**
   * Reference to a field of type 'RoleInvitationStatus[]'
   */
  export type ListEnumRoleInvitationStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'RoleInvitationStatus[]'>
    


  /**
   * Reference to a field of type 'Decimal'
   */
  export type DecimalFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Decimal'>
    


  /**
   * Reference to a field of type 'Decimal[]'
   */
  export type ListDecimalFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Decimal[]'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    
  /**
   * Deep Input Types
   */


  export type UserWhereInput = {
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    id?: StringFilter<"User"> | string
    displayName?: StringFilter<"User"> | string
    email?: StringFilter<"User"> | string
    phone?: StringNullableFilter<"User"> | string | null
    passwordHash?: StringFilter<"User"> | string
    accountStatus?: EnumAccountStatusFilter<"User"> | $Enums.AccountStatus
    profileImageUrl?: StringNullableFilter<"User"> | string | null
    emailVerifiedAt?: DateTimeNullableFilter<"User"> | Date | string | null
    phoneVerifiedAt?: DateTimeNullableFilter<"User"> | Date | string | null
    lastLoginAt?: DateTimeNullableFilter<"User"> | Date | string | null
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
    roles?: UserRoleAssignmentListRelationFilter
    authTokens?: AuthTokenListRelationFilter
    learnerProfile?: XOR<LearnerProfileNullableScalarRelationFilter, LearnerProfileWhereInput> | null
    supplierProfile?: XOR<SupplierProfileNullableScalarRelationFilter, SupplierProfileWhereInput> | null
    invitedRoles?: RoleInvitationListRelationFilter
    usedInvitations?: RoleInvitationListRelationFilter
    assignedRoles?: UserRoleAssignmentListRelationFilter
  }

  export type UserOrderByWithRelationInput = {
    id?: SortOrder
    displayName?: SortOrder
    email?: SortOrder
    phone?: SortOrderInput | SortOrder
    passwordHash?: SortOrder
    accountStatus?: SortOrder
    profileImageUrl?: SortOrderInput | SortOrder
    emailVerifiedAt?: SortOrderInput | SortOrder
    phoneVerifiedAt?: SortOrderInput | SortOrder
    lastLoginAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    roles?: UserRoleAssignmentOrderByRelationAggregateInput
    authTokens?: AuthTokenOrderByRelationAggregateInput
    learnerProfile?: LearnerProfileOrderByWithRelationInput
    supplierProfile?: SupplierProfileOrderByWithRelationInput
    invitedRoles?: RoleInvitationOrderByRelationAggregateInput
    usedInvitations?: RoleInvitationOrderByRelationAggregateInput
    assignedRoles?: UserRoleAssignmentOrderByRelationAggregateInput
  }

  export type UserWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    email?: string
    phone?: string
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    displayName?: StringFilter<"User"> | string
    passwordHash?: StringFilter<"User"> | string
    accountStatus?: EnumAccountStatusFilter<"User"> | $Enums.AccountStatus
    profileImageUrl?: StringNullableFilter<"User"> | string | null
    emailVerifiedAt?: DateTimeNullableFilter<"User"> | Date | string | null
    phoneVerifiedAt?: DateTimeNullableFilter<"User"> | Date | string | null
    lastLoginAt?: DateTimeNullableFilter<"User"> | Date | string | null
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
    roles?: UserRoleAssignmentListRelationFilter
    authTokens?: AuthTokenListRelationFilter
    learnerProfile?: XOR<LearnerProfileNullableScalarRelationFilter, LearnerProfileWhereInput> | null
    supplierProfile?: XOR<SupplierProfileNullableScalarRelationFilter, SupplierProfileWhereInput> | null
    invitedRoles?: RoleInvitationListRelationFilter
    usedInvitations?: RoleInvitationListRelationFilter
    assignedRoles?: UserRoleAssignmentListRelationFilter
  }, "id" | "email" | "phone">

  export type UserOrderByWithAggregationInput = {
    id?: SortOrder
    displayName?: SortOrder
    email?: SortOrder
    phone?: SortOrderInput | SortOrder
    passwordHash?: SortOrder
    accountStatus?: SortOrder
    profileImageUrl?: SortOrderInput | SortOrder
    emailVerifiedAt?: SortOrderInput | SortOrder
    phoneVerifiedAt?: SortOrderInput | SortOrder
    lastLoginAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: UserCountOrderByAggregateInput
    _max?: UserMaxOrderByAggregateInput
    _min?: UserMinOrderByAggregateInput
  }

  export type UserScalarWhereWithAggregatesInput = {
    AND?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    OR?: UserScalarWhereWithAggregatesInput[]
    NOT?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"User"> | string
    displayName?: StringWithAggregatesFilter<"User"> | string
    email?: StringWithAggregatesFilter<"User"> | string
    phone?: StringNullableWithAggregatesFilter<"User"> | string | null
    passwordHash?: StringWithAggregatesFilter<"User"> | string
    accountStatus?: EnumAccountStatusWithAggregatesFilter<"User"> | $Enums.AccountStatus
    profileImageUrl?: StringNullableWithAggregatesFilter<"User"> | string | null
    emailVerifiedAt?: DateTimeNullableWithAggregatesFilter<"User"> | Date | string | null
    phoneVerifiedAt?: DateTimeNullableWithAggregatesFilter<"User"> | Date | string | null
    lastLoginAt?: DateTimeNullableWithAggregatesFilter<"User"> | Date | string | null
    createdAt?: DateTimeWithAggregatesFilter<"User"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"User"> | Date | string
  }

  export type UserRoleAssignmentWhereInput = {
    AND?: UserRoleAssignmentWhereInput | UserRoleAssignmentWhereInput[]
    OR?: UserRoleAssignmentWhereInput[]
    NOT?: UserRoleAssignmentWhereInput | UserRoleAssignmentWhereInput[]
    id?: StringFilter<"UserRoleAssignment"> | string
    userId?: StringFilter<"UserRoleAssignment"> | string
    role?: EnumUserRoleFilter<"UserRoleAssignment"> | $Enums.UserRole
    isPrimary?: BoolFilter<"UserRoleAssignment"> | boolean
    assignedBy?: StringNullableFilter<"UserRoleAssignment"> | string | null
    createdAt?: DateTimeFilter<"UserRoleAssignment"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
    assignedByUser?: XOR<UserNullableScalarRelationFilter, UserWhereInput> | null
  }

  export type UserRoleAssignmentOrderByWithRelationInput = {
    id?: SortOrder
    userId?: SortOrder
    role?: SortOrder
    isPrimary?: SortOrder
    assignedBy?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    user?: UserOrderByWithRelationInput
    assignedByUser?: UserOrderByWithRelationInput
  }

  export type UserRoleAssignmentWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    userId_role?: UserRoleAssignmentUserIdRoleCompoundUniqueInput
    AND?: UserRoleAssignmentWhereInput | UserRoleAssignmentWhereInput[]
    OR?: UserRoleAssignmentWhereInput[]
    NOT?: UserRoleAssignmentWhereInput | UserRoleAssignmentWhereInput[]
    userId?: StringFilter<"UserRoleAssignment"> | string
    role?: EnumUserRoleFilter<"UserRoleAssignment"> | $Enums.UserRole
    isPrimary?: BoolFilter<"UserRoleAssignment"> | boolean
    assignedBy?: StringNullableFilter<"UserRoleAssignment"> | string | null
    createdAt?: DateTimeFilter<"UserRoleAssignment"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
    assignedByUser?: XOR<UserNullableScalarRelationFilter, UserWhereInput> | null
  }, "id" | "userId_role">

  export type UserRoleAssignmentOrderByWithAggregationInput = {
    id?: SortOrder
    userId?: SortOrder
    role?: SortOrder
    isPrimary?: SortOrder
    assignedBy?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    _count?: UserRoleAssignmentCountOrderByAggregateInput
    _max?: UserRoleAssignmentMaxOrderByAggregateInput
    _min?: UserRoleAssignmentMinOrderByAggregateInput
  }

  export type UserRoleAssignmentScalarWhereWithAggregatesInput = {
    AND?: UserRoleAssignmentScalarWhereWithAggregatesInput | UserRoleAssignmentScalarWhereWithAggregatesInput[]
    OR?: UserRoleAssignmentScalarWhereWithAggregatesInput[]
    NOT?: UserRoleAssignmentScalarWhereWithAggregatesInput | UserRoleAssignmentScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"UserRoleAssignment"> | string
    userId?: StringWithAggregatesFilter<"UserRoleAssignment"> | string
    role?: EnumUserRoleWithAggregatesFilter<"UserRoleAssignment"> | $Enums.UserRole
    isPrimary?: BoolWithAggregatesFilter<"UserRoleAssignment"> | boolean
    assignedBy?: StringNullableWithAggregatesFilter<"UserRoleAssignment"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"UserRoleAssignment"> | Date | string
  }

  export type AuthTokenWhereInput = {
    AND?: AuthTokenWhereInput | AuthTokenWhereInput[]
    OR?: AuthTokenWhereInput[]
    NOT?: AuthTokenWhereInput | AuthTokenWhereInput[]
    id?: StringFilter<"AuthToken"> | string
    userId?: StringFilter<"AuthToken"> | string
    tokenHash?: StringFilter<"AuthToken"> | string
    tokenType?: EnumAuthTokenTypeFilter<"AuthToken"> | $Enums.AuthTokenType
    target?: StringFilter<"AuthToken"> | string
    expiresAt?: DateTimeFilter<"AuthToken"> | Date | string
    usedAt?: DateTimeNullableFilter<"AuthToken"> | Date | string | null
    createdAt?: DateTimeFilter<"AuthToken"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }

  export type AuthTokenOrderByWithRelationInput = {
    id?: SortOrder
    userId?: SortOrder
    tokenHash?: SortOrder
    tokenType?: SortOrder
    target?: SortOrder
    expiresAt?: SortOrder
    usedAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    user?: UserOrderByWithRelationInput
  }

  export type AuthTokenWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    tokenHash?: string
    AND?: AuthTokenWhereInput | AuthTokenWhereInput[]
    OR?: AuthTokenWhereInput[]
    NOT?: AuthTokenWhereInput | AuthTokenWhereInput[]
    userId?: StringFilter<"AuthToken"> | string
    tokenType?: EnumAuthTokenTypeFilter<"AuthToken"> | $Enums.AuthTokenType
    target?: StringFilter<"AuthToken"> | string
    expiresAt?: DateTimeFilter<"AuthToken"> | Date | string
    usedAt?: DateTimeNullableFilter<"AuthToken"> | Date | string | null
    createdAt?: DateTimeFilter<"AuthToken"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }, "id" | "tokenHash">

  export type AuthTokenOrderByWithAggregationInput = {
    id?: SortOrder
    userId?: SortOrder
    tokenHash?: SortOrder
    tokenType?: SortOrder
    target?: SortOrder
    expiresAt?: SortOrder
    usedAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    _count?: AuthTokenCountOrderByAggregateInput
    _max?: AuthTokenMaxOrderByAggregateInput
    _min?: AuthTokenMinOrderByAggregateInput
  }

  export type AuthTokenScalarWhereWithAggregatesInput = {
    AND?: AuthTokenScalarWhereWithAggregatesInput | AuthTokenScalarWhereWithAggregatesInput[]
    OR?: AuthTokenScalarWhereWithAggregatesInput[]
    NOT?: AuthTokenScalarWhereWithAggregatesInput | AuthTokenScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"AuthToken"> | string
    userId?: StringWithAggregatesFilter<"AuthToken"> | string
    tokenHash?: StringWithAggregatesFilter<"AuthToken"> | string
    tokenType?: EnumAuthTokenTypeWithAggregatesFilter<"AuthToken"> | $Enums.AuthTokenType
    target?: StringWithAggregatesFilter<"AuthToken"> | string
    expiresAt?: DateTimeWithAggregatesFilter<"AuthToken"> | Date | string
    usedAt?: DateTimeNullableWithAggregatesFilter<"AuthToken"> | Date | string | null
    createdAt?: DateTimeWithAggregatesFilter<"AuthToken"> | Date | string
  }

  export type RoleInvitationWhereInput = {
    AND?: RoleInvitationWhereInput | RoleInvitationWhereInput[]
    OR?: RoleInvitationWhereInput[]
    NOT?: RoleInvitationWhereInput | RoleInvitationWhereInput[]
    id?: StringFilter<"RoleInvitation"> | string
    targetEmail?: StringNullableFilter<"RoleInvitation"> | string | null
    targetPhone?: StringNullableFilter<"RoleInvitation"> | string | null
    targetRole?: EnumRoleInvitationTargetRoleFilter<"RoleInvitation"> | $Enums.RoleInvitationTargetRole
    tokenHash?: StringFilter<"RoleInvitation"> | string
    invitedBy?: StringNullableFilter<"RoleInvitation"> | string | null
    status?: EnumRoleInvitationStatusFilter<"RoleInvitation"> | $Enums.RoleInvitationStatus
    expiresAt?: DateTimeFilter<"RoleInvitation"> | Date | string
    usedAt?: DateTimeNullableFilter<"RoleInvitation"> | Date | string | null
    usedByUserId?: StringNullableFilter<"RoleInvitation"> | string | null
    notes?: StringNullableFilter<"RoleInvitation"> | string | null
    createdAt?: DateTimeFilter<"RoleInvitation"> | Date | string
    invitedByUser?: XOR<UserNullableScalarRelationFilter, UserWhereInput> | null
    usedByUser?: XOR<UserNullableScalarRelationFilter, UserWhereInput> | null
  }

  export type RoleInvitationOrderByWithRelationInput = {
    id?: SortOrder
    targetEmail?: SortOrderInput | SortOrder
    targetPhone?: SortOrderInput | SortOrder
    targetRole?: SortOrder
    tokenHash?: SortOrder
    invitedBy?: SortOrderInput | SortOrder
    status?: SortOrder
    expiresAt?: SortOrder
    usedAt?: SortOrderInput | SortOrder
    usedByUserId?: SortOrderInput | SortOrder
    notes?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    invitedByUser?: UserOrderByWithRelationInput
    usedByUser?: UserOrderByWithRelationInput
  }

  export type RoleInvitationWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    tokenHash?: string
    AND?: RoleInvitationWhereInput | RoleInvitationWhereInput[]
    OR?: RoleInvitationWhereInput[]
    NOT?: RoleInvitationWhereInput | RoleInvitationWhereInput[]
    targetEmail?: StringNullableFilter<"RoleInvitation"> | string | null
    targetPhone?: StringNullableFilter<"RoleInvitation"> | string | null
    targetRole?: EnumRoleInvitationTargetRoleFilter<"RoleInvitation"> | $Enums.RoleInvitationTargetRole
    invitedBy?: StringNullableFilter<"RoleInvitation"> | string | null
    status?: EnumRoleInvitationStatusFilter<"RoleInvitation"> | $Enums.RoleInvitationStatus
    expiresAt?: DateTimeFilter<"RoleInvitation"> | Date | string
    usedAt?: DateTimeNullableFilter<"RoleInvitation"> | Date | string | null
    usedByUserId?: StringNullableFilter<"RoleInvitation"> | string | null
    notes?: StringNullableFilter<"RoleInvitation"> | string | null
    createdAt?: DateTimeFilter<"RoleInvitation"> | Date | string
    invitedByUser?: XOR<UserNullableScalarRelationFilter, UserWhereInput> | null
    usedByUser?: XOR<UserNullableScalarRelationFilter, UserWhereInput> | null
  }, "id" | "tokenHash">

  export type RoleInvitationOrderByWithAggregationInput = {
    id?: SortOrder
    targetEmail?: SortOrderInput | SortOrder
    targetPhone?: SortOrderInput | SortOrder
    targetRole?: SortOrder
    tokenHash?: SortOrder
    invitedBy?: SortOrderInput | SortOrder
    status?: SortOrder
    expiresAt?: SortOrder
    usedAt?: SortOrderInput | SortOrder
    usedByUserId?: SortOrderInput | SortOrder
    notes?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    _count?: RoleInvitationCountOrderByAggregateInput
    _max?: RoleInvitationMaxOrderByAggregateInput
    _min?: RoleInvitationMinOrderByAggregateInput
  }

  export type RoleInvitationScalarWhereWithAggregatesInput = {
    AND?: RoleInvitationScalarWhereWithAggregatesInput | RoleInvitationScalarWhereWithAggregatesInput[]
    OR?: RoleInvitationScalarWhereWithAggregatesInput[]
    NOT?: RoleInvitationScalarWhereWithAggregatesInput | RoleInvitationScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"RoleInvitation"> | string
    targetEmail?: StringNullableWithAggregatesFilter<"RoleInvitation"> | string | null
    targetPhone?: StringNullableWithAggregatesFilter<"RoleInvitation"> | string | null
    targetRole?: EnumRoleInvitationTargetRoleWithAggregatesFilter<"RoleInvitation"> | $Enums.RoleInvitationTargetRole
    tokenHash?: StringWithAggregatesFilter<"RoleInvitation"> | string
    invitedBy?: StringNullableWithAggregatesFilter<"RoleInvitation"> | string | null
    status?: EnumRoleInvitationStatusWithAggregatesFilter<"RoleInvitation"> | $Enums.RoleInvitationStatus
    expiresAt?: DateTimeWithAggregatesFilter<"RoleInvitation"> | Date | string
    usedAt?: DateTimeNullableWithAggregatesFilter<"RoleInvitation"> | Date | string | null
    usedByUserId?: StringNullableWithAggregatesFilter<"RoleInvitation"> | string | null
    notes?: StringNullableWithAggregatesFilter<"RoleInvitation"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"RoleInvitation"> | Date | string
  }

  export type LearnerProfileWhereInput = {
    AND?: LearnerProfileWhereInput | LearnerProfileWhereInput[]
    OR?: LearnerProfileWhereInput[]
    NOT?: LearnerProfileWhereInput | LearnerProfileWhereInput[]
    id?: StringFilter<"LearnerProfile"> | string
    userId?: StringFilter<"LearnerProfile"> | string
    learnerType?: StringNullableFilter<"LearnerProfile"> | string | null
    bio?: StringNullableFilter<"LearnerProfile"> | string | null
    interests?: StringNullableListFilter<"LearnerProfile">
    skillLevel?: StringNullableFilter<"LearnerProfile"> | string | null
    createdAt?: DateTimeFilter<"LearnerProfile"> | Date | string
    updatedAt?: DateTimeFilter<"LearnerProfile"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }

  export type LearnerProfileOrderByWithRelationInput = {
    id?: SortOrder
    userId?: SortOrder
    learnerType?: SortOrderInput | SortOrder
    bio?: SortOrderInput | SortOrder
    interests?: SortOrder
    skillLevel?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    user?: UserOrderByWithRelationInput
  }

  export type LearnerProfileWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    userId?: string
    AND?: LearnerProfileWhereInput | LearnerProfileWhereInput[]
    OR?: LearnerProfileWhereInput[]
    NOT?: LearnerProfileWhereInput | LearnerProfileWhereInput[]
    learnerType?: StringNullableFilter<"LearnerProfile"> | string | null
    bio?: StringNullableFilter<"LearnerProfile"> | string | null
    interests?: StringNullableListFilter<"LearnerProfile">
    skillLevel?: StringNullableFilter<"LearnerProfile"> | string | null
    createdAt?: DateTimeFilter<"LearnerProfile"> | Date | string
    updatedAt?: DateTimeFilter<"LearnerProfile"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }, "id" | "userId">

  export type LearnerProfileOrderByWithAggregationInput = {
    id?: SortOrder
    userId?: SortOrder
    learnerType?: SortOrderInput | SortOrder
    bio?: SortOrderInput | SortOrder
    interests?: SortOrder
    skillLevel?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: LearnerProfileCountOrderByAggregateInput
    _max?: LearnerProfileMaxOrderByAggregateInput
    _min?: LearnerProfileMinOrderByAggregateInput
  }

  export type LearnerProfileScalarWhereWithAggregatesInput = {
    AND?: LearnerProfileScalarWhereWithAggregatesInput | LearnerProfileScalarWhereWithAggregatesInput[]
    OR?: LearnerProfileScalarWhereWithAggregatesInput[]
    NOT?: LearnerProfileScalarWhereWithAggregatesInput | LearnerProfileScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"LearnerProfile"> | string
    userId?: StringWithAggregatesFilter<"LearnerProfile"> | string
    learnerType?: StringNullableWithAggregatesFilter<"LearnerProfile"> | string | null
    bio?: StringNullableWithAggregatesFilter<"LearnerProfile"> | string | null
    interests?: StringNullableListFilter<"LearnerProfile">
    skillLevel?: StringNullableWithAggregatesFilter<"LearnerProfile"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"LearnerProfile"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"LearnerProfile"> | Date | string
  }

  export type SupplierProfileWhereInput = {
    AND?: SupplierProfileWhereInput | SupplierProfileWhereInput[]
    OR?: SupplierProfileWhereInput[]
    NOT?: SupplierProfileWhereInput | SupplierProfileWhereInput[]
    id?: StringFilter<"SupplierProfile"> | string
    userId?: StringFilter<"SupplierProfile"> | string
    supplierType?: StringNullableFilter<"SupplierProfile"> | string | null
    publicName?: StringNullableFilter<"SupplierProfile"> | string | null
    description?: StringNullableFilter<"SupplierProfile"> | string | null
    verificationStatus?: StringFilter<"SupplierProfile"> | string
    defaultPickupLocationId?: StringNullableFilter<"SupplierProfile"> | string | null
    createdAt?: DateTimeFilter<"SupplierProfile"> | Date | string
    updatedAt?: DateTimeFilter<"SupplierProfile"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
    defaultPickupLocation?: XOR<LocationNullableScalarRelationFilter, LocationWhereInput> | null
  }

  export type SupplierProfileOrderByWithRelationInput = {
    id?: SortOrder
    userId?: SortOrder
    supplierType?: SortOrderInput | SortOrder
    publicName?: SortOrderInput | SortOrder
    description?: SortOrderInput | SortOrder
    verificationStatus?: SortOrder
    defaultPickupLocationId?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    user?: UserOrderByWithRelationInput
    defaultPickupLocation?: LocationOrderByWithRelationInput
  }

  export type SupplierProfileWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    userId?: string
    AND?: SupplierProfileWhereInput | SupplierProfileWhereInput[]
    OR?: SupplierProfileWhereInput[]
    NOT?: SupplierProfileWhereInput | SupplierProfileWhereInput[]
    supplierType?: StringNullableFilter<"SupplierProfile"> | string | null
    publicName?: StringNullableFilter<"SupplierProfile"> | string | null
    description?: StringNullableFilter<"SupplierProfile"> | string | null
    verificationStatus?: StringFilter<"SupplierProfile"> | string
    defaultPickupLocationId?: StringNullableFilter<"SupplierProfile"> | string | null
    createdAt?: DateTimeFilter<"SupplierProfile"> | Date | string
    updatedAt?: DateTimeFilter<"SupplierProfile"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
    defaultPickupLocation?: XOR<LocationNullableScalarRelationFilter, LocationWhereInput> | null
  }, "id" | "userId">

  export type SupplierProfileOrderByWithAggregationInput = {
    id?: SortOrder
    userId?: SortOrder
    supplierType?: SortOrderInput | SortOrder
    publicName?: SortOrderInput | SortOrder
    description?: SortOrderInput | SortOrder
    verificationStatus?: SortOrder
    defaultPickupLocationId?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: SupplierProfileCountOrderByAggregateInput
    _max?: SupplierProfileMaxOrderByAggregateInput
    _min?: SupplierProfileMinOrderByAggregateInput
  }

  export type SupplierProfileScalarWhereWithAggregatesInput = {
    AND?: SupplierProfileScalarWhereWithAggregatesInput | SupplierProfileScalarWhereWithAggregatesInput[]
    OR?: SupplierProfileScalarWhereWithAggregatesInput[]
    NOT?: SupplierProfileScalarWhereWithAggregatesInput | SupplierProfileScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"SupplierProfile"> | string
    userId?: StringWithAggregatesFilter<"SupplierProfile"> | string
    supplierType?: StringNullableWithAggregatesFilter<"SupplierProfile"> | string | null
    publicName?: StringNullableWithAggregatesFilter<"SupplierProfile"> | string | null
    description?: StringNullableWithAggregatesFilter<"SupplierProfile"> | string | null
    verificationStatus?: StringWithAggregatesFilter<"SupplierProfile"> | string
    defaultPickupLocationId?: StringNullableWithAggregatesFilter<"SupplierProfile"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"SupplierProfile"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"SupplierProfile"> | Date | string
  }

  export type LocationWhereInput = {
    AND?: LocationWhereInput | LocationWhereInput[]
    OR?: LocationWhereInput[]
    NOT?: LocationWhereInput | LocationWhereInput[]
    id?: StringFilter<"Location"> | string
    country?: StringFilter<"Location"> | string
    city?: StringFilter<"Location"> | string
    area?: StringNullableFilter<"Location"> | string | null
    addressLine?: StringNullableFilter<"Location"> | string | null
    latitude?: DecimalNullableFilter<"Location"> | Decimal | DecimalJsLike | number | string | null
    longitude?: DecimalNullableFilter<"Location"> | Decimal | DecimalJsLike | number | string | null
    locationType?: StringNullableFilter<"Location"> | string | null
    visibility?: StringNullableFilter<"Location"> | string | null
    isApproximate?: BoolFilter<"Location"> | boolean
    createdAt?: DateTimeFilter<"Location"> | Date | string
    updatedAt?: DateTimeFilter<"Location"> | Date | string
    supplierPickupFor?: SupplierProfileListRelationFilter
  }

  export type LocationOrderByWithRelationInput = {
    id?: SortOrder
    country?: SortOrder
    city?: SortOrder
    area?: SortOrderInput | SortOrder
    addressLine?: SortOrderInput | SortOrder
    latitude?: SortOrderInput | SortOrder
    longitude?: SortOrderInput | SortOrder
    locationType?: SortOrderInput | SortOrder
    visibility?: SortOrderInput | SortOrder
    isApproximate?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    supplierPickupFor?: SupplierProfileOrderByRelationAggregateInput
  }

  export type LocationWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: LocationWhereInput | LocationWhereInput[]
    OR?: LocationWhereInput[]
    NOT?: LocationWhereInput | LocationWhereInput[]
    country?: StringFilter<"Location"> | string
    city?: StringFilter<"Location"> | string
    area?: StringNullableFilter<"Location"> | string | null
    addressLine?: StringNullableFilter<"Location"> | string | null
    latitude?: DecimalNullableFilter<"Location"> | Decimal | DecimalJsLike | number | string | null
    longitude?: DecimalNullableFilter<"Location"> | Decimal | DecimalJsLike | number | string | null
    locationType?: StringNullableFilter<"Location"> | string | null
    visibility?: StringNullableFilter<"Location"> | string | null
    isApproximate?: BoolFilter<"Location"> | boolean
    createdAt?: DateTimeFilter<"Location"> | Date | string
    updatedAt?: DateTimeFilter<"Location"> | Date | string
    supplierPickupFor?: SupplierProfileListRelationFilter
  }, "id">

  export type LocationOrderByWithAggregationInput = {
    id?: SortOrder
    country?: SortOrder
    city?: SortOrder
    area?: SortOrderInput | SortOrder
    addressLine?: SortOrderInput | SortOrder
    latitude?: SortOrderInput | SortOrder
    longitude?: SortOrderInput | SortOrder
    locationType?: SortOrderInput | SortOrder
    visibility?: SortOrderInput | SortOrder
    isApproximate?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: LocationCountOrderByAggregateInput
    _avg?: LocationAvgOrderByAggregateInput
    _max?: LocationMaxOrderByAggregateInput
    _min?: LocationMinOrderByAggregateInput
    _sum?: LocationSumOrderByAggregateInput
  }

  export type LocationScalarWhereWithAggregatesInput = {
    AND?: LocationScalarWhereWithAggregatesInput | LocationScalarWhereWithAggregatesInput[]
    OR?: LocationScalarWhereWithAggregatesInput[]
    NOT?: LocationScalarWhereWithAggregatesInput | LocationScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Location"> | string
    country?: StringWithAggregatesFilter<"Location"> | string
    city?: StringWithAggregatesFilter<"Location"> | string
    area?: StringNullableWithAggregatesFilter<"Location"> | string | null
    addressLine?: StringNullableWithAggregatesFilter<"Location"> | string | null
    latitude?: DecimalNullableWithAggregatesFilter<"Location"> | Decimal | DecimalJsLike | number | string | null
    longitude?: DecimalNullableWithAggregatesFilter<"Location"> | Decimal | DecimalJsLike | number | string | null
    locationType?: StringNullableWithAggregatesFilter<"Location"> | string | null
    visibility?: StringNullableWithAggregatesFilter<"Location"> | string | null
    isApproximate?: BoolWithAggregatesFilter<"Location"> | boolean
    createdAt?: DateTimeWithAggregatesFilter<"Location"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Location"> | Date | string
  }

  export type UserCreateInput = {
    id?: string
    displayName: string
    email: string
    phone?: string | null
    passwordHash: string
    accountStatus?: $Enums.AccountStatus
    profileImageUrl?: string | null
    emailVerifiedAt?: Date | string | null
    phoneVerifiedAt?: Date | string | null
    lastLoginAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    roles?: UserRoleAssignmentCreateNestedManyWithoutUserInput
    authTokens?: AuthTokenCreateNestedManyWithoutUserInput
    learnerProfile?: LearnerProfileCreateNestedOneWithoutUserInput
    supplierProfile?: SupplierProfileCreateNestedOneWithoutUserInput
    invitedRoles?: RoleInvitationCreateNestedManyWithoutInvitedByUserInput
    usedInvitations?: RoleInvitationCreateNestedManyWithoutUsedByUserInput
    assignedRoles?: UserRoleAssignmentCreateNestedManyWithoutAssignedByUserInput
  }

  export type UserUncheckedCreateInput = {
    id?: string
    displayName: string
    email: string
    phone?: string | null
    passwordHash: string
    accountStatus?: $Enums.AccountStatus
    profileImageUrl?: string | null
    emailVerifiedAt?: Date | string | null
    phoneVerifiedAt?: Date | string | null
    lastLoginAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    roles?: UserRoleAssignmentUncheckedCreateNestedManyWithoutUserInput
    authTokens?: AuthTokenUncheckedCreateNestedManyWithoutUserInput
    learnerProfile?: LearnerProfileUncheckedCreateNestedOneWithoutUserInput
    supplierProfile?: SupplierProfileUncheckedCreateNestedOneWithoutUserInput
    invitedRoles?: RoleInvitationUncheckedCreateNestedManyWithoutInvitedByUserInput
    usedInvitations?: RoleInvitationUncheckedCreateNestedManyWithoutUsedByUserInput
    assignedRoles?: UserRoleAssignmentUncheckedCreateNestedManyWithoutAssignedByUserInput
  }

  export type UserUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    passwordHash?: StringFieldUpdateOperationsInput | string
    accountStatus?: EnumAccountStatusFieldUpdateOperationsInput | $Enums.AccountStatus
    profileImageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    phoneVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    roles?: UserRoleAssignmentUpdateManyWithoutUserNestedInput
    authTokens?: AuthTokenUpdateManyWithoutUserNestedInput
    learnerProfile?: LearnerProfileUpdateOneWithoutUserNestedInput
    supplierProfile?: SupplierProfileUpdateOneWithoutUserNestedInput
    invitedRoles?: RoleInvitationUpdateManyWithoutInvitedByUserNestedInput
    usedInvitations?: RoleInvitationUpdateManyWithoutUsedByUserNestedInput
    assignedRoles?: UserRoleAssignmentUpdateManyWithoutAssignedByUserNestedInput
  }

  export type UserUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    passwordHash?: StringFieldUpdateOperationsInput | string
    accountStatus?: EnumAccountStatusFieldUpdateOperationsInput | $Enums.AccountStatus
    profileImageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    phoneVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    roles?: UserRoleAssignmentUncheckedUpdateManyWithoutUserNestedInput
    authTokens?: AuthTokenUncheckedUpdateManyWithoutUserNestedInput
    learnerProfile?: LearnerProfileUncheckedUpdateOneWithoutUserNestedInput
    supplierProfile?: SupplierProfileUncheckedUpdateOneWithoutUserNestedInput
    invitedRoles?: RoleInvitationUncheckedUpdateManyWithoutInvitedByUserNestedInput
    usedInvitations?: RoleInvitationUncheckedUpdateManyWithoutUsedByUserNestedInput
    assignedRoles?: UserRoleAssignmentUncheckedUpdateManyWithoutAssignedByUserNestedInput
  }

  export type UserCreateManyInput = {
    id?: string
    displayName: string
    email: string
    phone?: string | null
    passwordHash: string
    accountStatus?: $Enums.AccountStatus
    profileImageUrl?: string | null
    emailVerifiedAt?: Date | string | null
    phoneVerifiedAt?: Date | string | null
    lastLoginAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type UserUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    passwordHash?: StringFieldUpdateOperationsInput | string
    accountStatus?: EnumAccountStatusFieldUpdateOperationsInput | $Enums.AccountStatus
    profileImageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    phoneVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    passwordHash?: StringFieldUpdateOperationsInput | string
    accountStatus?: EnumAccountStatusFieldUpdateOperationsInput | $Enums.AccountStatus
    profileImageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    phoneVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserRoleAssignmentCreateInput = {
    id?: string
    role: $Enums.UserRole
    isPrimary?: boolean
    createdAt?: Date | string
    user: UserCreateNestedOneWithoutRolesInput
    assignedByUser?: UserCreateNestedOneWithoutAssignedRolesInput
  }

  export type UserRoleAssignmentUncheckedCreateInput = {
    id?: string
    userId: string
    role: $Enums.UserRole
    isPrimary?: boolean
    assignedBy?: string | null
    createdAt?: Date | string
  }

  export type UserRoleAssignmentUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    role?: EnumUserRoleFieldUpdateOperationsInput | $Enums.UserRole
    isPrimary?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutRolesNestedInput
    assignedByUser?: UserUpdateOneWithoutAssignedRolesNestedInput
  }

  export type UserRoleAssignmentUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    role?: EnumUserRoleFieldUpdateOperationsInput | $Enums.UserRole
    isPrimary?: BoolFieldUpdateOperationsInput | boolean
    assignedBy?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserRoleAssignmentCreateManyInput = {
    id?: string
    userId: string
    role: $Enums.UserRole
    isPrimary?: boolean
    assignedBy?: string | null
    createdAt?: Date | string
  }

  export type UserRoleAssignmentUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    role?: EnumUserRoleFieldUpdateOperationsInput | $Enums.UserRole
    isPrimary?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserRoleAssignmentUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    role?: EnumUserRoleFieldUpdateOperationsInput | $Enums.UserRole
    isPrimary?: BoolFieldUpdateOperationsInput | boolean
    assignedBy?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AuthTokenCreateInput = {
    id?: string
    tokenHash: string
    tokenType: $Enums.AuthTokenType
    target: string
    expiresAt: Date | string
    usedAt?: Date | string | null
    createdAt?: Date | string
    user: UserCreateNestedOneWithoutAuthTokensInput
  }

  export type AuthTokenUncheckedCreateInput = {
    id?: string
    userId: string
    tokenHash: string
    tokenType: $Enums.AuthTokenType
    target: string
    expiresAt: Date | string
    usedAt?: Date | string | null
    createdAt?: Date | string
  }

  export type AuthTokenUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    tokenHash?: StringFieldUpdateOperationsInput | string
    tokenType?: EnumAuthTokenTypeFieldUpdateOperationsInput | $Enums.AuthTokenType
    target?: StringFieldUpdateOperationsInput | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutAuthTokensNestedInput
  }

  export type AuthTokenUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    tokenHash?: StringFieldUpdateOperationsInput | string
    tokenType?: EnumAuthTokenTypeFieldUpdateOperationsInput | $Enums.AuthTokenType
    target?: StringFieldUpdateOperationsInput | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AuthTokenCreateManyInput = {
    id?: string
    userId: string
    tokenHash: string
    tokenType: $Enums.AuthTokenType
    target: string
    expiresAt: Date | string
    usedAt?: Date | string | null
    createdAt?: Date | string
  }

  export type AuthTokenUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    tokenHash?: StringFieldUpdateOperationsInput | string
    tokenType?: EnumAuthTokenTypeFieldUpdateOperationsInput | $Enums.AuthTokenType
    target?: StringFieldUpdateOperationsInput | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AuthTokenUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    tokenHash?: StringFieldUpdateOperationsInput | string
    tokenType?: EnumAuthTokenTypeFieldUpdateOperationsInput | $Enums.AuthTokenType
    target?: StringFieldUpdateOperationsInput | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RoleInvitationCreateInput = {
    id?: string
    targetEmail?: string | null
    targetPhone?: string | null
    targetRole: $Enums.RoleInvitationTargetRole
    tokenHash: string
    status?: $Enums.RoleInvitationStatus
    expiresAt: Date | string
    usedAt?: Date | string | null
    notes?: string | null
    createdAt?: Date | string
    invitedByUser?: UserCreateNestedOneWithoutInvitedRolesInput
    usedByUser?: UserCreateNestedOneWithoutUsedInvitationsInput
  }

  export type RoleInvitationUncheckedCreateInput = {
    id?: string
    targetEmail?: string | null
    targetPhone?: string | null
    targetRole: $Enums.RoleInvitationTargetRole
    tokenHash: string
    invitedBy?: string | null
    status?: $Enums.RoleInvitationStatus
    expiresAt: Date | string
    usedAt?: Date | string | null
    usedByUserId?: string | null
    notes?: string | null
    createdAt?: Date | string
  }

  export type RoleInvitationUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    targetEmail?: NullableStringFieldUpdateOperationsInput | string | null
    targetPhone?: NullableStringFieldUpdateOperationsInput | string | null
    targetRole?: EnumRoleInvitationTargetRoleFieldUpdateOperationsInput | $Enums.RoleInvitationTargetRole
    tokenHash?: StringFieldUpdateOperationsInput | string
    status?: EnumRoleInvitationStatusFieldUpdateOperationsInput | $Enums.RoleInvitationStatus
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    invitedByUser?: UserUpdateOneWithoutInvitedRolesNestedInput
    usedByUser?: UserUpdateOneWithoutUsedInvitationsNestedInput
  }

  export type RoleInvitationUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    targetEmail?: NullableStringFieldUpdateOperationsInput | string | null
    targetPhone?: NullableStringFieldUpdateOperationsInput | string | null
    targetRole?: EnumRoleInvitationTargetRoleFieldUpdateOperationsInput | $Enums.RoleInvitationTargetRole
    tokenHash?: StringFieldUpdateOperationsInput | string
    invitedBy?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumRoleInvitationStatusFieldUpdateOperationsInput | $Enums.RoleInvitationStatus
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    usedByUserId?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RoleInvitationCreateManyInput = {
    id?: string
    targetEmail?: string | null
    targetPhone?: string | null
    targetRole: $Enums.RoleInvitationTargetRole
    tokenHash: string
    invitedBy?: string | null
    status?: $Enums.RoleInvitationStatus
    expiresAt: Date | string
    usedAt?: Date | string | null
    usedByUserId?: string | null
    notes?: string | null
    createdAt?: Date | string
  }

  export type RoleInvitationUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    targetEmail?: NullableStringFieldUpdateOperationsInput | string | null
    targetPhone?: NullableStringFieldUpdateOperationsInput | string | null
    targetRole?: EnumRoleInvitationTargetRoleFieldUpdateOperationsInput | $Enums.RoleInvitationTargetRole
    tokenHash?: StringFieldUpdateOperationsInput | string
    status?: EnumRoleInvitationStatusFieldUpdateOperationsInput | $Enums.RoleInvitationStatus
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RoleInvitationUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    targetEmail?: NullableStringFieldUpdateOperationsInput | string | null
    targetPhone?: NullableStringFieldUpdateOperationsInput | string | null
    targetRole?: EnumRoleInvitationTargetRoleFieldUpdateOperationsInput | $Enums.RoleInvitationTargetRole
    tokenHash?: StringFieldUpdateOperationsInput | string
    invitedBy?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumRoleInvitationStatusFieldUpdateOperationsInput | $Enums.RoleInvitationStatus
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    usedByUserId?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type LearnerProfileCreateInput = {
    id?: string
    learnerType?: string | null
    bio?: string | null
    interests?: LearnerProfileCreateinterestsInput | string[]
    skillLevel?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    user: UserCreateNestedOneWithoutLearnerProfileInput
  }

  export type LearnerProfileUncheckedCreateInput = {
    id?: string
    userId: string
    learnerType?: string | null
    bio?: string | null
    interests?: LearnerProfileCreateinterestsInput | string[]
    skillLevel?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type LearnerProfileUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    learnerType?: NullableStringFieldUpdateOperationsInput | string | null
    bio?: NullableStringFieldUpdateOperationsInput | string | null
    interests?: LearnerProfileUpdateinterestsInput | string[]
    skillLevel?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutLearnerProfileNestedInput
  }

  export type LearnerProfileUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    learnerType?: NullableStringFieldUpdateOperationsInput | string | null
    bio?: NullableStringFieldUpdateOperationsInput | string | null
    interests?: LearnerProfileUpdateinterestsInput | string[]
    skillLevel?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type LearnerProfileCreateManyInput = {
    id?: string
    userId: string
    learnerType?: string | null
    bio?: string | null
    interests?: LearnerProfileCreateinterestsInput | string[]
    skillLevel?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type LearnerProfileUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    learnerType?: NullableStringFieldUpdateOperationsInput | string | null
    bio?: NullableStringFieldUpdateOperationsInput | string | null
    interests?: LearnerProfileUpdateinterestsInput | string[]
    skillLevel?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type LearnerProfileUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    learnerType?: NullableStringFieldUpdateOperationsInput | string | null
    bio?: NullableStringFieldUpdateOperationsInput | string | null
    interests?: LearnerProfileUpdateinterestsInput | string[]
    skillLevel?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SupplierProfileCreateInput = {
    id?: string
    supplierType?: string | null
    publicName?: string | null
    description?: string | null
    verificationStatus?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    user: UserCreateNestedOneWithoutSupplierProfileInput
    defaultPickupLocation?: LocationCreateNestedOneWithoutSupplierPickupForInput
  }

  export type SupplierProfileUncheckedCreateInput = {
    id?: string
    userId: string
    supplierType?: string | null
    publicName?: string | null
    description?: string | null
    verificationStatus?: string
    defaultPickupLocationId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type SupplierProfileUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    supplierType?: NullableStringFieldUpdateOperationsInput | string | null
    publicName?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    verificationStatus?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutSupplierProfileNestedInput
    defaultPickupLocation?: LocationUpdateOneWithoutSupplierPickupForNestedInput
  }

  export type SupplierProfileUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    supplierType?: NullableStringFieldUpdateOperationsInput | string | null
    publicName?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    verificationStatus?: StringFieldUpdateOperationsInput | string
    defaultPickupLocationId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SupplierProfileCreateManyInput = {
    id?: string
    userId: string
    supplierType?: string | null
    publicName?: string | null
    description?: string | null
    verificationStatus?: string
    defaultPickupLocationId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type SupplierProfileUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    supplierType?: NullableStringFieldUpdateOperationsInput | string | null
    publicName?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    verificationStatus?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SupplierProfileUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    supplierType?: NullableStringFieldUpdateOperationsInput | string | null
    publicName?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    verificationStatus?: StringFieldUpdateOperationsInput | string
    defaultPickupLocationId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type LocationCreateInput = {
    id?: string
    country: string
    city: string
    area?: string | null
    addressLine?: string | null
    latitude?: Decimal | DecimalJsLike | number | string | null
    longitude?: Decimal | DecimalJsLike | number | string | null
    locationType?: string | null
    visibility?: string | null
    isApproximate?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    supplierPickupFor?: SupplierProfileCreateNestedManyWithoutDefaultPickupLocationInput
  }

  export type LocationUncheckedCreateInput = {
    id?: string
    country: string
    city: string
    area?: string | null
    addressLine?: string | null
    latitude?: Decimal | DecimalJsLike | number | string | null
    longitude?: Decimal | DecimalJsLike | number | string | null
    locationType?: string | null
    visibility?: string | null
    isApproximate?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    supplierPickupFor?: SupplierProfileUncheckedCreateNestedManyWithoutDefaultPickupLocationInput
  }

  export type LocationUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    country?: StringFieldUpdateOperationsInput | string
    city?: StringFieldUpdateOperationsInput | string
    area?: NullableStringFieldUpdateOperationsInput | string | null
    addressLine?: NullableStringFieldUpdateOperationsInput | string | null
    latitude?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    longitude?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    locationType?: NullableStringFieldUpdateOperationsInput | string | null
    visibility?: NullableStringFieldUpdateOperationsInput | string | null
    isApproximate?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    supplierPickupFor?: SupplierProfileUpdateManyWithoutDefaultPickupLocationNestedInput
  }

  export type LocationUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    country?: StringFieldUpdateOperationsInput | string
    city?: StringFieldUpdateOperationsInput | string
    area?: NullableStringFieldUpdateOperationsInput | string | null
    addressLine?: NullableStringFieldUpdateOperationsInput | string | null
    latitude?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    longitude?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    locationType?: NullableStringFieldUpdateOperationsInput | string | null
    visibility?: NullableStringFieldUpdateOperationsInput | string | null
    isApproximate?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    supplierPickupFor?: SupplierProfileUncheckedUpdateManyWithoutDefaultPickupLocationNestedInput
  }

  export type LocationCreateManyInput = {
    id?: string
    country: string
    city: string
    area?: string | null
    addressLine?: string | null
    latitude?: Decimal | DecimalJsLike | number | string | null
    longitude?: Decimal | DecimalJsLike | number | string | null
    locationType?: string | null
    visibility?: string | null
    isApproximate?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type LocationUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    country?: StringFieldUpdateOperationsInput | string
    city?: StringFieldUpdateOperationsInput | string
    area?: NullableStringFieldUpdateOperationsInput | string | null
    addressLine?: NullableStringFieldUpdateOperationsInput | string | null
    latitude?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    longitude?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    locationType?: NullableStringFieldUpdateOperationsInput | string | null
    visibility?: NullableStringFieldUpdateOperationsInput | string | null
    isApproximate?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type LocationUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    country?: StringFieldUpdateOperationsInput | string
    city?: StringFieldUpdateOperationsInput | string
    area?: NullableStringFieldUpdateOperationsInput | string | null
    addressLine?: NullableStringFieldUpdateOperationsInput | string | null
    latitude?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    longitude?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    locationType?: NullableStringFieldUpdateOperationsInput | string | null
    visibility?: NullableStringFieldUpdateOperationsInput | string | null
    isApproximate?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type EnumAccountStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.AccountStatus | EnumAccountStatusFieldRefInput<$PrismaModel>
    in?: $Enums.AccountStatus[] | ListEnumAccountStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.AccountStatus[] | ListEnumAccountStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumAccountStatusFilter<$PrismaModel> | $Enums.AccountStatus
  }

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type UserRoleAssignmentListRelationFilter = {
    every?: UserRoleAssignmentWhereInput
    some?: UserRoleAssignmentWhereInput
    none?: UserRoleAssignmentWhereInput
  }

  export type AuthTokenListRelationFilter = {
    every?: AuthTokenWhereInput
    some?: AuthTokenWhereInput
    none?: AuthTokenWhereInput
  }

  export type LearnerProfileNullableScalarRelationFilter = {
    is?: LearnerProfileWhereInput | null
    isNot?: LearnerProfileWhereInput | null
  }

  export type SupplierProfileNullableScalarRelationFilter = {
    is?: SupplierProfileWhereInput | null
    isNot?: SupplierProfileWhereInput | null
  }

  export type RoleInvitationListRelationFilter = {
    every?: RoleInvitationWhereInput
    some?: RoleInvitationWhereInput
    none?: RoleInvitationWhereInput
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type UserRoleAssignmentOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type AuthTokenOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type RoleInvitationOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type UserCountOrderByAggregateInput = {
    id?: SortOrder
    displayName?: SortOrder
    email?: SortOrder
    phone?: SortOrder
    passwordHash?: SortOrder
    accountStatus?: SortOrder
    profileImageUrl?: SortOrder
    emailVerifiedAt?: SortOrder
    phoneVerifiedAt?: SortOrder
    lastLoginAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserMaxOrderByAggregateInput = {
    id?: SortOrder
    displayName?: SortOrder
    email?: SortOrder
    phone?: SortOrder
    passwordHash?: SortOrder
    accountStatus?: SortOrder
    profileImageUrl?: SortOrder
    emailVerifiedAt?: SortOrder
    phoneVerifiedAt?: SortOrder
    lastLoginAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserMinOrderByAggregateInput = {
    id?: SortOrder
    displayName?: SortOrder
    email?: SortOrder
    phone?: SortOrder
    passwordHash?: SortOrder
    accountStatus?: SortOrder
    profileImageUrl?: SortOrder
    emailVerifiedAt?: SortOrder
    phoneVerifiedAt?: SortOrder
    lastLoginAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type EnumAccountStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.AccountStatus | EnumAccountStatusFieldRefInput<$PrismaModel>
    in?: $Enums.AccountStatus[] | ListEnumAccountStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.AccountStatus[] | ListEnumAccountStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumAccountStatusWithAggregatesFilter<$PrismaModel> | $Enums.AccountStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumAccountStatusFilter<$PrismaModel>
    _max?: NestedEnumAccountStatusFilter<$PrismaModel>
  }

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type EnumUserRoleFilter<$PrismaModel = never> = {
    equals?: $Enums.UserRole | EnumUserRoleFieldRefInput<$PrismaModel>
    in?: $Enums.UserRole[] | ListEnumUserRoleFieldRefInput<$PrismaModel>
    notIn?: $Enums.UserRole[] | ListEnumUserRoleFieldRefInput<$PrismaModel>
    not?: NestedEnumUserRoleFilter<$PrismaModel> | $Enums.UserRole
  }

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type UserScalarRelationFilter = {
    is?: UserWhereInput
    isNot?: UserWhereInput
  }

  export type UserNullableScalarRelationFilter = {
    is?: UserWhereInput | null
    isNot?: UserWhereInput | null
  }

  export type UserRoleAssignmentUserIdRoleCompoundUniqueInput = {
    userId: string
    role: $Enums.UserRole
  }

  export type UserRoleAssignmentCountOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    role?: SortOrder
    isPrimary?: SortOrder
    assignedBy?: SortOrder
    createdAt?: SortOrder
  }

  export type UserRoleAssignmentMaxOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    role?: SortOrder
    isPrimary?: SortOrder
    assignedBy?: SortOrder
    createdAt?: SortOrder
  }

  export type UserRoleAssignmentMinOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    role?: SortOrder
    isPrimary?: SortOrder
    assignedBy?: SortOrder
    createdAt?: SortOrder
  }

  export type EnumUserRoleWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.UserRole | EnumUserRoleFieldRefInput<$PrismaModel>
    in?: $Enums.UserRole[] | ListEnumUserRoleFieldRefInput<$PrismaModel>
    notIn?: $Enums.UserRole[] | ListEnumUserRoleFieldRefInput<$PrismaModel>
    not?: NestedEnumUserRoleWithAggregatesFilter<$PrismaModel> | $Enums.UserRole
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumUserRoleFilter<$PrismaModel>
    _max?: NestedEnumUserRoleFilter<$PrismaModel>
  }

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type EnumAuthTokenTypeFilter<$PrismaModel = never> = {
    equals?: $Enums.AuthTokenType | EnumAuthTokenTypeFieldRefInput<$PrismaModel>
    in?: $Enums.AuthTokenType[] | ListEnumAuthTokenTypeFieldRefInput<$PrismaModel>
    notIn?: $Enums.AuthTokenType[] | ListEnumAuthTokenTypeFieldRefInput<$PrismaModel>
    not?: NestedEnumAuthTokenTypeFilter<$PrismaModel> | $Enums.AuthTokenType
  }

  export type AuthTokenCountOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    tokenHash?: SortOrder
    tokenType?: SortOrder
    target?: SortOrder
    expiresAt?: SortOrder
    usedAt?: SortOrder
    createdAt?: SortOrder
  }

  export type AuthTokenMaxOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    tokenHash?: SortOrder
    tokenType?: SortOrder
    target?: SortOrder
    expiresAt?: SortOrder
    usedAt?: SortOrder
    createdAt?: SortOrder
  }

  export type AuthTokenMinOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    tokenHash?: SortOrder
    tokenType?: SortOrder
    target?: SortOrder
    expiresAt?: SortOrder
    usedAt?: SortOrder
    createdAt?: SortOrder
  }

  export type EnumAuthTokenTypeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.AuthTokenType | EnumAuthTokenTypeFieldRefInput<$PrismaModel>
    in?: $Enums.AuthTokenType[] | ListEnumAuthTokenTypeFieldRefInput<$PrismaModel>
    notIn?: $Enums.AuthTokenType[] | ListEnumAuthTokenTypeFieldRefInput<$PrismaModel>
    not?: NestedEnumAuthTokenTypeWithAggregatesFilter<$PrismaModel> | $Enums.AuthTokenType
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumAuthTokenTypeFilter<$PrismaModel>
    _max?: NestedEnumAuthTokenTypeFilter<$PrismaModel>
  }

  export type EnumRoleInvitationTargetRoleFilter<$PrismaModel = never> = {
    equals?: $Enums.RoleInvitationTargetRole | EnumRoleInvitationTargetRoleFieldRefInput<$PrismaModel>
    in?: $Enums.RoleInvitationTargetRole[] | ListEnumRoleInvitationTargetRoleFieldRefInput<$PrismaModel>
    notIn?: $Enums.RoleInvitationTargetRole[] | ListEnumRoleInvitationTargetRoleFieldRefInput<$PrismaModel>
    not?: NestedEnumRoleInvitationTargetRoleFilter<$PrismaModel> | $Enums.RoleInvitationTargetRole
  }

  export type EnumRoleInvitationStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.RoleInvitationStatus | EnumRoleInvitationStatusFieldRefInput<$PrismaModel>
    in?: $Enums.RoleInvitationStatus[] | ListEnumRoleInvitationStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.RoleInvitationStatus[] | ListEnumRoleInvitationStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumRoleInvitationStatusFilter<$PrismaModel> | $Enums.RoleInvitationStatus
  }

  export type RoleInvitationCountOrderByAggregateInput = {
    id?: SortOrder
    targetEmail?: SortOrder
    targetPhone?: SortOrder
    targetRole?: SortOrder
    tokenHash?: SortOrder
    invitedBy?: SortOrder
    status?: SortOrder
    expiresAt?: SortOrder
    usedAt?: SortOrder
    usedByUserId?: SortOrder
    notes?: SortOrder
    createdAt?: SortOrder
  }

  export type RoleInvitationMaxOrderByAggregateInput = {
    id?: SortOrder
    targetEmail?: SortOrder
    targetPhone?: SortOrder
    targetRole?: SortOrder
    tokenHash?: SortOrder
    invitedBy?: SortOrder
    status?: SortOrder
    expiresAt?: SortOrder
    usedAt?: SortOrder
    usedByUserId?: SortOrder
    notes?: SortOrder
    createdAt?: SortOrder
  }

  export type RoleInvitationMinOrderByAggregateInput = {
    id?: SortOrder
    targetEmail?: SortOrder
    targetPhone?: SortOrder
    targetRole?: SortOrder
    tokenHash?: SortOrder
    invitedBy?: SortOrder
    status?: SortOrder
    expiresAt?: SortOrder
    usedAt?: SortOrder
    usedByUserId?: SortOrder
    notes?: SortOrder
    createdAt?: SortOrder
  }

  export type EnumRoleInvitationTargetRoleWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.RoleInvitationTargetRole | EnumRoleInvitationTargetRoleFieldRefInput<$PrismaModel>
    in?: $Enums.RoleInvitationTargetRole[] | ListEnumRoleInvitationTargetRoleFieldRefInput<$PrismaModel>
    notIn?: $Enums.RoleInvitationTargetRole[] | ListEnumRoleInvitationTargetRoleFieldRefInput<$PrismaModel>
    not?: NestedEnumRoleInvitationTargetRoleWithAggregatesFilter<$PrismaModel> | $Enums.RoleInvitationTargetRole
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumRoleInvitationTargetRoleFilter<$PrismaModel>
    _max?: NestedEnumRoleInvitationTargetRoleFilter<$PrismaModel>
  }

  export type EnumRoleInvitationStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.RoleInvitationStatus | EnumRoleInvitationStatusFieldRefInput<$PrismaModel>
    in?: $Enums.RoleInvitationStatus[] | ListEnumRoleInvitationStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.RoleInvitationStatus[] | ListEnumRoleInvitationStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumRoleInvitationStatusWithAggregatesFilter<$PrismaModel> | $Enums.RoleInvitationStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumRoleInvitationStatusFilter<$PrismaModel>
    _max?: NestedEnumRoleInvitationStatusFilter<$PrismaModel>
  }

  export type StringNullableListFilter<$PrismaModel = never> = {
    equals?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    has?: string | StringFieldRefInput<$PrismaModel> | null
    hasEvery?: string[] | ListStringFieldRefInput<$PrismaModel>
    hasSome?: string[] | ListStringFieldRefInput<$PrismaModel>
    isEmpty?: boolean
  }

  export type LearnerProfileCountOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    learnerType?: SortOrder
    bio?: SortOrder
    interests?: SortOrder
    skillLevel?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type LearnerProfileMaxOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    learnerType?: SortOrder
    bio?: SortOrder
    skillLevel?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type LearnerProfileMinOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    learnerType?: SortOrder
    bio?: SortOrder
    skillLevel?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type LocationNullableScalarRelationFilter = {
    is?: LocationWhereInput | null
    isNot?: LocationWhereInput | null
  }

  export type SupplierProfileCountOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    supplierType?: SortOrder
    publicName?: SortOrder
    description?: SortOrder
    verificationStatus?: SortOrder
    defaultPickupLocationId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type SupplierProfileMaxOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    supplierType?: SortOrder
    publicName?: SortOrder
    description?: SortOrder
    verificationStatus?: SortOrder
    defaultPickupLocationId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type SupplierProfileMinOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    supplierType?: SortOrder
    publicName?: SortOrder
    description?: SortOrder
    verificationStatus?: SortOrder
    defaultPickupLocationId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type DecimalNullableFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel> | null
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalNullableFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string | null
  }

  export type SupplierProfileListRelationFilter = {
    every?: SupplierProfileWhereInput
    some?: SupplierProfileWhereInput
    none?: SupplierProfileWhereInput
  }

  export type SupplierProfileOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type LocationCountOrderByAggregateInput = {
    id?: SortOrder
    country?: SortOrder
    city?: SortOrder
    area?: SortOrder
    addressLine?: SortOrder
    latitude?: SortOrder
    longitude?: SortOrder
    locationType?: SortOrder
    visibility?: SortOrder
    isApproximate?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type LocationAvgOrderByAggregateInput = {
    latitude?: SortOrder
    longitude?: SortOrder
  }

  export type LocationMaxOrderByAggregateInput = {
    id?: SortOrder
    country?: SortOrder
    city?: SortOrder
    area?: SortOrder
    addressLine?: SortOrder
    latitude?: SortOrder
    longitude?: SortOrder
    locationType?: SortOrder
    visibility?: SortOrder
    isApproximate?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type LocationMinOrderByAggregateInput = {
    id?: SortOrder
    country?: SortOrder
    city?: SortOrder
    area?: SortOrder
    addressLine?: SortOrder
    latitude?: SortOrder
    longitude?: SortOrder
    locationType?: SortOrder
    visibility?: SortOrder
    isApproximate?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type LocationSumOrderByAggregateInput = {
    latitude?: SortOrder
    longitude?: SortOrder
  }

  export type DecimalNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel> | null
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalNullableWithAggregatesFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedDecimalNullableFilter<$PrismaModel>
    _sum?: NestedDecimalNullableFilter<$PrismaModel>
    _min?: NestedDecimalNullableFilter<$PrismaModel>
    _max?: NestedDecimalNullableFilter<$PrismaModel>
  }

  export type UserRoleAssignmentCreateNestedManyWithoutUserInput = {
    create?: XOR<UserRoleAssignmentCreateWithoutUserInput, UserRoleAssignmentUncheckedCreateWithoutUserInput> | UserRoleAssignmentCreateWithoutUserInput[] | UserRoleAssignmentUncheckedCreateWithoutUserInput[]
    connectOrCreate?: UserRoleAssignmentCreateOrConnectWithoutUserInput | UserRoleAssignmentCreateOrConnectWithoutUserInput[]
    createMany?: UserRoleAssignmentCreateManyUserInputEnvelope
    connect?: UserRoleAssignmentWhereUniqueInput | UserRoleAssignmentWhereUniqueInput[]
  }

  export type AuthTokenCreateNestedManyWithoutUserInput = {
    create?: XOR<AuthTokenCreateWithoutUserInput, AuthTokenUncheckedCreateWithoutUserInput> | AuthTokenCreateWithoutUserInput[] | AuthTokenUncheckedCreateWithoutUserInput[]
    connectOrCreate?: AuthTokenCreateOrConnectWithoutUserInput | AuthTokenCreateOrConnectWithoutUserInput[]
    createMany?: AuthTokenCreateManyUserInputEnvelope
    connect?: AuthTokenWhereUniqueInput | AuthTokenWhereUniqueInput[]
  }

  export type LearnerProfileCreateNestedOneWithoutUserInput = {
    create?: XOR<LearnerProfileCreateWithoutUserInput, LearnerProfileUncheckedCreateWithoutUserInput>
    connectOrCreate?: LearnerProfileCreateOrConnectWithoutUserInput
    connect?: LearnerProfileWhereUniqueInput
  }

  export type SupplierProfileCreateNestedOneWithoutUserInput = {
    create?: XOR<SupplierProfileCreateWithoutUserInput, SupplierProfileUncheckedCreateWithoutUserInput>
    connectOrCreate?: SupplierProfileCreateOrConnectWithoutUserInput
    connect?: SupplierProfileWhereUniqueInput
  }

  export type RoleInvitationCreateNestedManyWithoutInvitedByUserInput = {
    create?: XOR<RoleInvitationCreateWithoutInvitedByUserInput, RoleInvitationUncheckedCreateWithoutInvitedByUserInput> | RoleInvitationCreateWithoutInvitedByUserInput[] | RoleInvitationUncheckedCreateWithoutInvitedByUserInput[]
    connectOrCreate?: RoleInvitationCreateOrConnectWithoutInvitedByUserInput | RoleInvitationCreateOrConnectWithoutInvitedByUserInput[]
    createMany?: RoleInvitationCreateManyInvitedByUserInputEnvelope
    connect?: RoleInvitationWhereUniqueInput | RoleInvitationWhereUniqueInput[]
  }

  export type RoleInvitationCreateNestedManyWithoutUsedByUserInput = {
    create?: XOR<RoleInvitationCreateWithoutUsedByUserInput, RoleInvitationUncheckedCreateWithoutUsedByUserInput> | RoleInvitationCreateWithoutUsedByUserInput[] | RoleInvitationUncheckedCreateWithoutUsedByUserInput[]
    connectOrCreate?: RoleInvitationCreateOrConnectWithoutUsedByUserInput | RoleInvitationCreateOrConnectWithoutUsedByUserInput[]
    createMany?: RoleInvitationCreateManyUsedByUserInputEnvelope
    connect?: RoleInvitationWhereUniqueInput | RoleInvitationWhereUniqueInput[]
  }

  export type UserRoleAssignmentCreateNestedManyWithoutAssignedByUserInput = {
    create?: XOR<UserRoleAssignmentCreateWithoutAssignedByUserInput, UserRoleAssignmentUncheckedCreateWithoutAssignedByUserInput> | UserRoleAssignmentCreateWithoutAssignedByUserInput[] | UserRoleAssignmentUncheckedCreateWithoutAssignedByUserInput[]
    connectOrCreate?: UserRoleAssignmentCreateOrConnectWithoutAssignedByUserInput | UserRoleAssignmentCreateOrConnectWithoutAssignedByUserInput[]
    createMany?: UserRoleAssignmentCreateManyAssignedByUserInputEnvelope
    connect?: UserRoleAssignmentWhereUniqueInput | UserRoleAssignmentWhereUniqueInput[]
  }

  export type UserRoleAssignmentUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<UserRoleAssignmentCreateWithoutUserInput, UserRoleAssignmentUncheckedCreateWithoutUserInput> | UserRoleAssignmentCreateWithoutUserInput[] | UserRoleAssignmentUncheckedCreateWithoutUserInput[]
    connectOrCreate?: UserRoleAssignmentCreateOrConnectWithoutUserInput | UserRoleAssignmentCreateOrConnectWithoutUserInput[]
    createMany?: UserRoleAssignmentCreateManyUserInputEnvelope
    connect?: UserRoleAssignmentWhereUniqueInput | UserRoleAssignmentWhereUniqueInput[]
  }

  export type AuthTokenUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<AuthTokenCreateWithoutUserInput, AuthTokenUncheckedCreateWithoutUserInput> | AuthTokenCreateWithoutUserInput[] | AuthTokenUncheckedCreateWithoutUserInput[]
    connectOrCreate?: AuthTokenCreateOrConnectWithoutUserInput | AuthTokenCreateOrConnectWithoutUserInput[]
    createMany?: AuthTokenCreateManyUserInputEnvelope
    connect?: AuthTokenWhereUniqueInput | AuthTokenWhereUniqueInput[]
  }

  export type LearnerProfileUncheckedCreateNestedOneWithoutUserInput = {
    create?: XOR<LearnerProfileCreateWithoutUserInput, LearnerProfileUncheckedCreateWithoutUserInput>
    connectOrCreate?: LearnerProfileCreateOrConnectWithoutUserInput
    connect?: LearnerProfileWhereUniqueInput
  }

  export type SupplierProfileUncheckedCreateNestedOneWithoutUserInput = {
    create?: XOR<SupplierProfileCreateWithoutUserInput, SupplierProfileUncheckedCreateWithoutUserInput>
    connectOrCreate?: SupplierProfileCreateOrConnectWithoutUserInput
    connect?: SupplierProfileWhereUniqueInput
  }

  export type RoleInvitationUncheckedCreateNestedManyWithoutInvitedByUserInput = {
    create?: XOR<RoleInvitationCreateWithoutInvitedByUserInput, RoleInvitationUncheckedCreateWithoutInvitedByUserInput> | RoleInvitationCreateWithoutInvitedByUserInput[] | RoleInvitationUncheckedCreateWithoutInvitedByUserInput[]
    connectOrCreate?: RoleInvitationCreateOrConnectWithoutInvitedByUserInput | RoleInvitationCreateOrConnectWithoutInvitedByUserInput[]
    createMany?: RoleInvitationCreateManyInvitedByUserInputEnvelope
    connect?: RoleInvitationWhereUniqueInput | RoleInvitationWhereUniqueInput[]
  }

  export type RoleInvitationUncheckedCreateNestedManyWithoutUsedByUserInput = {
    create?: XOR<RoleInvitationCreateWithoutUsedByUserInput, RoleInvitationUncheckedCreateWithoutUsedByUserInput> | RoleInvitationCreateWithoutUsedByUserInput[] | RoleInvitationUncheckedCreateWithoutUsedByUserInput[]
    connectOrCreate?: RoleInvitationCreateOrConnectWithoutUsedByUserInput | RoleInvitationCreateOrConnectWithoutUsedByUserInput[]
    createMany?: RoleInvitationCreateManyUsedByUserInputEnvelope
    connect?: RoleInvitationWhereUniqueInput | RoleInvitationWhereUniqueInput[]
  }

  export type UserRoleAssignmentUncheckedCreateNestedManyWithoutAssignedByUserInput = {
    create?: XOR<UserRoleAssignmentCreateWithoutAssignedByUserInput, UserRoleAssignmentUncheckedCreateWithoutAssignedByUserInput> | UserRoleAssignmentCreateWithoutAssignedByUserInput[] | UserRoleAssignmentUncheckedCreateWithoutAssignedByUserInput[]
    connectOrCreate?: UserRoleAssignmentCreateOrConnectWithoutAssignedByUserInput | UserRoleAssignmentCreateOrConnectWithoutAssignedByUserInput[]
    createMany?: UserRoleAssignmentCreateManyAssignedByUserInputEnvelope
    connect?: UserRoleAssignmentWhereUniqueInput | UserRoleAssignmentWhereUniqueInput[]
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type EnumAccountStatusFieldUpdateOperationsInput = {
    set?: $Enums.AccountStatus
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type UserRoleAssignmentUpdateManyWithoutUserNestedInput = {
    create?: XOR<UserRoleAssignmentCreateWithoutUserInput, UserRoleAssignmentUncheckedCreateWithoutUserInput> | UserRoleAssignmentCreateWithoutUserInput[] | UserRoleAssignmentUncheckedCreateWithoutUserInput[]
    connectOrCreate?: UserRoleAssignmentCreateOrConnectWithoutUserInput | UserRoleAssignmentCreateOrConnectWithoutUserInput[]
    upsert?: UserRoleAssignmentUpsertWithWhereUniqueWithoutUserInput | UserRoleAssignmentUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: UserRoleAssignmentCreateManyUserInputEnvelope
    set?: UserRoleAssignmentWhereUniqueInput | UserRoleAssignmentWhereUniqueInput[]
    disconnect?: UserRoleAssignmentWhereUniqueInput | UserRoleAssignmentWhereUniqueInput[]
    delete?: UserRoleAssignmentWhereUniqueInput | UserRoleAssignmentWhereUniqueInput[]
    connect?: UserRoleAssignmentWhereUniqueInput | UserRoleAssignmentWhereUniqueInput[]
    update?: UserRoleAssignmentUpdateWithWhereUniqueWithoutUserInput | UserRoleAssignmentUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: UserRoleAssignmentUpdateManyWithWhereWithoutUserInput | UserRoleAssignmentUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: UserRoleAssignmentScalarWhereInput | UserRoleAssignmentScalarWhereInput[]
  }

  export type AuthTokenUpdateManyWithoutUserNestedInput = {
    create?: XOR<AuthTokenCreateWithoutUserInput, AuthTokenUncheckedCreateWithoutUserInput> | AuthTokenCreateWithoutUserInput[] | AuthTokenUncheckedCreateWithoutUserInput[]
    connectOrCreate?: AuthTokenCreateOrConnectWithoutUserInput | AuthTokenCreateOrConnectWithoutUserInput[]
    upsert?: AuthTokenUpsertWithWhereUniqueWithoutUserInput | AuthTokenUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: AuthTokenCreateManyUserInputEnvelope
    set?: AuthTokenWhereUniqueInput | AuthTokenWhereUniqueInput[]
    disconnect?: AuthTokenWhereUniqueInput | AuthTokenWhereUniqueInput[]
    delete?: AuthTokenWhereUniqueInput | AuthTokenWhereUniqueInput[]
    connect?: AuthTokenWhereUniqueInput | AuthTokenWhereUniqueInput[]
    update?: AuthTokenUpdateWithWhereUniqueWithoutUserInput | AuthTokenUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: AuthTokenUpdateManyWithWhereWithoutUserInput | AuthTokenUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: AuthTokenScalarWhereInput | AuthTokenScalarWhereInput[]
  }

  export type LearnerProfileUpdateOneWithoutUserNestedInput = {
    create?: XOR<LearnerProfileCreateWithoutUserInput, LearnerProfileUncheckedCreateWithoutUserInput>
    connectOrCreate?: LearnerProfileCreateOrConnectWithoutUserInput
    upsert?: LearnerProfileUpsertWithoutUserInput
    disconnect?: LearnerProfileWhereInput | boolean
    delete?: LearnerProfileWhereInput | boolean
    connect?: LearnerProfileWhereUniqueInput
    update?: XOR<XOR<LearnerProfileUpdateToOneWithWhereWithoutUserInput, LearnerProfileUpdateWithoutUserInput>, LearnerProfileUncheckedUpdateWithoutUserInput>
  }

  export type SupplierProfileUpdateOneWithoutUserNestedInput = {
    create?: XOR<SupplierProfileCreateWithoutUserInput, SupplierProfileUncheckedCreateWithoutUserInput>
    connectOrCreate?: SupplierProfileCreateOrConnectWithoutUserInput
    upsert?: SupplierProfileUpsertWithoutUserInput
    disconnect?: SupplierProfileWhereInput | boolean
    delete?: SupplierProfileWhereInput | boolean
    connect?: SupplierProfileWhereUniqueInput
    update?: XOR<XOR<SupplierProfileUpdateToOneWithWhereWithoutUserInput, SupplierProfileUpdateWithoutUserInput>, SupplierProfileUncheckedUpdateWithoutUserInput>
  }

  export type RoleInvitationUpdateManyWithoutInvitedByUserNestedInput = {
    create?: XOR<RoleInvitationCreateWithoutInvitedByUserInput, RoleInvitationUncheckedCreateWithoutInvitedByUserInput> | RoleInvitationCreateWithoutInvitedByUserInput[] | RoleInvitationUncheckedCreateWithoutInvitedByUserInput[]
    connectOrCreate?: RoleInvitationCreateOrConnectWithoutInvitedByUserInput | RoleInvitationCreateOrConnectWithoutInvitedByUserInput[]
    upsert?: RoleInvitationUpsertWithWhereUniqueWithoutInvitedByUserInput | RoleInvitationUpsertWithWhereUniqueWithoutInvitedByUserInput[]
    createMany?: RoleInvitationCreateManyInvitedByUserInputEnvelope
    set?: RoleInvitationWhereUniqueInput | RoleInvitationWhereUniqueInput[]
    disconnect?: RoleInvitationWhereUniqueInput | RoleInvitationWhereUniqueInput[]
    delete?: RoleInvitationWhereUniqueInput | RoleInvitationWhereUniqueInput[]
    connect?: RoleInvitationWhereUniqueInput | RoleInvitationWhereUniqueInput[]
    update?: RoleInvitationUpdateWithWhereUniqueWithoutInvitedByUserInput | RoleInvitationUpdateWithWhereUniqueWithoutInvitedByUserInput[]
    updateMany?: RoleInvitationUpdateManyWithWhereWithoutInvitedByUserInput | RoleInvitationUpdateManyWithWhereWithoutInvitedByUserInput[]
    deleteMany?: RoleInvitationScalarWhereInput | RoleInvitationScalarWhereInput[]
  }

  export type RoleInvitationUpdateManyWithoutUsedByUserNestedInput = {
    create?: XOR<RoleInvitationCreateWithoutUsedByUserInput, RoleInvitationUncheckedCreateWithoutUsedByUserInput> | RoleInvitationCreateWithoutUsedByUserInput[] | RoleInvitationUncheckedCreateWithoutUsedByUserInput[]
    connectOrCreate?: RoleInvitationCreateOrConnectWithoutUsedByUserInput | RoleInvitationCreateOrConnectWithoutUsedByUserInput[]
    upsert?: RoleInvitationUpsertWithWhereUniqueWithoutUsedByUserInput | RoleInvitationUpsertWithWhereUniqueWithoutUsedByUserInput[]
    createMany?: RoleInvitationCreateManyUsedByUserInputEnvelope
    set?: RoleInvitationWhereUniqueInput | RoleInvitationWhereUniqueInput[]
    disconnect?: RoleInvitationWhereUniqueInput | RoleInvitationWhereUniqueInput[]
    delete?: RoleInvitationWhereUniqueInput | RoleInvitationWhereUniqueInput[]
    connect?: RoleInvitationWhereUniqueInput | RoleInvitationWhereUniqueInput[]
    update?: RoleInvitationUpdateWithWhereUniqueWithoutUsedByUserInput | RoleInvitationUpdateWithWhereUniqueWithoutUsedByUserInput[]
    updateMany?: RoleInvitationUpdateManyWithWhereWithoutUsedByUserInput | RoleInvitationUpdateManyWithWhereWithoutUsedByUserInput[]
    deleteMany?: RoleInvitationScalarWhereInput | RoleInvitationScalarWhereInput[]
  }

  export type UserRoleAssignmentUpdateManyWithoutAssignedByUserNestedInput = {
    create?: XOR<UserRoleAssignmentCreateWithoutAssignedByUserInput, UserRoleAssignmentUncheckedCreateWithoutAssignedByUserInput> | UserRoleAssignmentCreateWithoutAssignedByUserInput[] | UserRoleAssignmentUncheckedCreateWithoutAssignedByUserInput[]
    connectOrCreate?: UserRoleAssignmentCreateOrConnectWithoutAssignedByUserInput | UserRoleAssignmentCreateOrConnectWithoutAssignedByUserInput[]
    upsert?: UserRoleAssignmentUpsertWithWhereUniqueWithoutAssignedByUserInput | UserRoleAssignmentUpsertWithWhereUniqueWithoutAssignedByUserInput[]
    createMany?: UserRoleAssignmentCreateManyAssignedByUserInputEnvelope
    set?: UserRoleAssignmentWhereUniqueInput | UserRoleAssignmentWhereUniqueInput[]
    disconnect?: UserRoleAssignmentWhereUniqueInput | UserRoleAssignmentWhereUniqueInput[]
    delete?: UserRoleAssignmentWhereUniqueInput | UserRoleAssignmentWhereUniqueInput[]
    connect?: UserRoleAssignmentWhereUniqueInput | UserRoleAssignmentWhereUniqueInput[]
    update?: UserRoleAssignmentUpdateWithWhereUniqueWithoutAssignedByUserInput | UserRoleAssignmentUpdateWithWhereUniqueWithoutAssignedByUserInput[]
    updateMany?: UserRoleAssignmentUpdateManyWithWhereWithoutAssignedByUserInput | UserRoleAssignmentUpdateManyWithWhereWithoutAssignedByUserInput[]
    deleteMany?: UserRoleAssignmentScalarWhereInput | UserRoleAssignmentScalarWhereInput[]
  }

  export type UserRoleAssignmentUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<UserRoleAssignmentCreateWithoutUserInput, UserRoleAssignmentUncheckedCreateWithoutUserInput> | UserRoleAssignmentCreateWithoutUserInput[] | UserRoleAssignmentUncheckedCreateWithoutUserInput[]
    connectOrCreate?: UserRoleAssignmentCreateOrConnectWithoutUserInput | UserRoleAssignmentCreateOrConnectWithoutUserInput[]
    upsert?: UserRoleAssignmentUpsertWithWhereUniqueWithoutUserInput | UserRoleAssignmentUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: UserRoleAssignmentCreateManyUserInputEnvelope
    set?: UserRoleAssignmentWhereUniqueInput | UserRoleAssignmentWhereUniqueInput[]
    disconnect?: UserRoleAssignmentWhereUniqueInput | UserRoleAssignmentWhereUniqueInput[]
    delete?: UserRoleAssignmentWhereUniqueInput | UserRoleAssignmentWhereUniqueInput[]
    connect?: UserRoleAssignmentWhereUniqueInput | UserRoleAssignmentWhereUniqueInput[]
    update?: UserRoleAssignmentUpdateWithWhereUniqueWithoutUserInput | UserRoleAssignmentUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: UserRoleAssignmentUpdateManyWithWhereWithoutUserInput | UserRoleAssignmentUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: UserRoleAssignmentScalarWhereInput | UserRoleAssignmentScalarWhereInput[]
  }

  export type AuthTokenUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<AuthTokenCreateWithoutUserInput, AuthTokenUncheckedCreateWithoutUserInput> | AuthTokenCreateWithoutUserInput[] | AuthTokenUncheckedCreateWithoutUserInput[]
    connectOrCreate?: AuthTokenCreateOrConnectWithoutUserInput | AuthTokenCreateOrConnectWithoutUserInput[]
    upsert?: AuthTokenUpsertWithWhereUniqueWithoutUserInput | AuthTokenUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: AuthTokenCreateManyUserInputEnvelope
    set?: AuthTokenWhereUniqueInput | AuthTokenWhereUniqueInput[]
    disconnect?: AuthTokenWhereUniqueInput | AuthTokenWhereUniqueInput[]
    delete?: AuthTokenWhereUniqueInput | AuthTokenWhereUniqueInput[]
    connect?: AuthTokenWhereUniqueInput | AuthTokenWhereUniqueInput[]
    update?: AuthTokenUpdateWithWhereUniqueWithoutUserInput | AuthTokenUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: AuthTokenUpdateManyWithWhereWithoutUserInput | AuthTokenUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: AuthTokenScalarWhereInput | AuthTokenScalarWhereInput[]
  }

  export type LearnerProfileUncheckedUpdateOneWithoutUserNestedInput = {
    create?: XOR<LearnerProfileCreateWithoutUserInput, LearnerProfileUncheckedCreateWithoutUserInput>
    connectOrCreate?: LearnerProfileCreateOrConnectWithoutUserInput
    upsert?: LearnerProfileUpsertWithoutUserInput
    disconnect?: LearnerProfileWhereInput | boolean
    delete?: LearnerProfileWhereInput | boolean
    connect?: LearnerProfileWhereUniqueInput
    update?: XOR<XOR<LearnerProfileUpdateToOneWithWhereWithoutUserInput, LearnerProfileUpdateWithoutUserInput>, LearnerProfileUncheckedUpdateWithoutUserInput>
  }

  export type SupplierProfileUncheckedUpdateOneWithoutUserNestedInput = {
    create?: XOR<SupplierProfileCreateWithoutUserInput, SupplierProfileUncheckedCreateWithoutUserInput>
    connectOrCreate?: SupplierProfileCreateOrConnectWithoutUserInput
    upsert?: SupplierProfileUpsertWithoutUserInput
    disconnect?: SupplierProfileWhereInput | boolean
    delete?: SupplierProfileWhereInput | boolean
    connect?: SupplierProfileWhereUniqueInput
    update?: XOR<XOR<SupplierProfileUpdateToOneWithWhereWithoutUserInput, SupplierProfileUpdateWithoutUserInput>, SupplierProfileUncheckedUpdateWithoutUserInput>
  }

  export type RoleInvitationUncheckedUpdateManyWithoutInvitedByUserNestedInput = {
    create?: XOR<RoleInvitationCreateWithoutInvitedByUserInput, RoleInvitationUncheckedCreateWithoutInvitedByUserInput> | RoleInvitationCreateWithoutInvitedByUserInput[] | RoleInvitationUncheckedCreateWithoutInvitedByUserInput[]
    connectOrCreate?: RoleInvitationCreateOrConnectWithoutInvitedByUserInput | RoleInvitationCreateOrConnectWithoutInvitedByUserInput[]
    upsert?: RoleInvitationUpsertWithWhereUniqueWithoutInvitedByUserInput | RoleInvitationUpsertWithWhereUniqueWithoutInvitedByUserInput[]
    createMany?: RoleInvitationCreateManyInvitedByUserInputEnvelope
    set?: RoleInvitationWhereUniqueInput | RoleInvitationWhereUniqueInput[]
    disconnect?: RoleInvitationWhereUniqueInput | RoleInvitationWhereUniqueInput[]
    delete?: RoleInvitationWhereUniqueInput | RoleInvitationWhereUniqueInput[]
    connect?: RoleInvitationWhereUniqueInput | RoleInvitationWhereUniqueInput[]
    update?: RoleInvitationUpdateWithWhereUniqueWithoutInvitedByUserInput | RoleInvitationUpdateWithWhereUniqueWithoutInvitedByUserInput[]
    updateMany?: RoleInvitationUpdateManyWithWhereWithoutInvitedByUserInput | RoleInvitationUpdateManyWithWhereWithoutInvitedByUserInput[]
    deleteMany?: RoleInvitationScalarWhereInput | RoleInvitationScalarWhereInput[]
  }

  export type RoleInvitationUncheckedUpdateManyWithoutUsedByUserNestedInput = {
    create?: XOR<RoleInvitationCreateWithoutUsedByUserInput, RoleInvitationUncheckedCreateWithoutUsedByUserInput> | RoleInvitationCreateWithoutUsedByUserInput[] | RoleInvitationUncheckedCreateWithoutUsedByUserInput[]
    connectOrCreate?: RoleInvitationCreateOrConnectWithoutUsedByUserInput | RoleInvitationCreateOrConnectWithoutUsedByUserInput[]
    upsert?: RoleInvitationUpsertWithWhereUniqueWithoutUsedByUserInput | RoleInvitationUpsertWithWhereUniqueWithoutUsedByUserInput[]
    createMany?: RoleInvitationCreateManyUsedByUserInputEnvelope
    set?: RoleInvitationWhereUniqueInput | RoleInvitationWhereUniqueInput[]
    disconnect?: RoleInvitationWhereUniqueInput | RoleInvitationWhereUniqueInput[]
    delete?: RoleInvitationWhereUniqueInput | RoleInvitationWhereUniqueInput[]
    connect?: RoleInvitationWhereUniqueInput | RoleInvitationWhereUniqueInput[]
    update?: RoleInvitationUpdateWithWhereUniqueWithoutUsedByUserInput | RoleInvitationUpdateWithWhereUniqueWithoutUsedByUserInput[]
    updateMany?: RoleInvitationUpdateManyWithWhereWithoutUsedByUserInput | RoleInvitationUpdateManyWithWhereWithoutUsedByUserInput[]
    deleteMany?: RoleInvitationScalarWhereInput | RoleInvitationScalarWhereInput[]
  }

  export type UserRoleAssignmentUncheckedUpdateManyWithoutAssignedByUserNestedInput = {
    create?: XOR<UserRoleAssignmentCreateWithoutAssignedByUserInput, UserRoleAssignmentUncheckedCreateWithoutAssignedByUserInput> | UserRoleAssignmentCreateWithoutAssignedByUserInput[] | UserRoleAssignmentUncheckedCreateWithoutAssignedByUserInput[]
    connectOrCreate?: UserRoleAssignmentCreateOrConnectWithoutAssignedByUserInput | UserRoleAssignmentCreateOrConnectWithoutAssignedByUserInput[]
    upsert?: UserRoleAssignmentUpsertWithWhereUniqueWithoutAssignedByUserInput | UserRoleAssignmentUpsertWithWhereUniqueWithoutAssignedByUserInput[]
    createMany?: UserRoleAssignmentCreateManyAssignedByUserInputEnvelope
    set?: UserRoleAssignmentWhereUniqueInput | UserRoleAssignmentWhereUniqueInput[]
    disconnect?: UserRoleAssignmentWhereUniqueInput | UserRoleAssignmentWhereUniqueInput[]
    delete?: UserRoleAssignmentWhereUniqueInput | UserRoleAssignmentWhereUniqueInput[]
    connect?: UserRoleAssignmentWhereUniqueInput | UserRoleAssignmentWhereUniqueInput[]
    update?: UserRoleAssignmentUpdateWithWhereUniqueWithoutAssignedByUserInput | UserRoleAssignmentUpdateWithWhereUniqueWithoutAssignedByUserInput[]
    updateMany?: UserRoleAssignmentUpdateManyWithWhereWithoutAssignedByUserInput | UserRoleAssignmentUpdateManyWithWhereWithoutAssignedByUserInput[]
    deleteMany?: UserRoleAssignmentScalarWhereInput | UserRoleAssignmentScalarWhereInput[]
  }

  export type UserCreateNestedOneWithoutRolesInput = {
    create?: XOR<UserCreateWithoutRolesInput, UserUncheckedCreateWithoutRolesInput>
    connectOrCreate?: UserCreateOrConnectWithoutRolesInput
    connect?: UserWhereUniqueInput
  }

  export type UserCreateNestedOneWithoutAssignedRolesInput = {
    create?: XOR<UserCreateWithoutAssignedRolesInput, UserUncheckedCreateWithoutAssignedRolesInput>
    connectOrCreate?: UserCreateOrConnectWithoutAssignedRolesInput
    connect?: UserWhereUniqueInput
  }

  export type EnumUserRoleFieldUpdateOperationsInput = {
    set?: $Enums.UserRole
  }

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean
  }

  export type UserUpdateOneRequiredWithoutRolesNestedInput = {
    create?: XOR<UserCreateWithoutRolesInput, UserUncheckedCreateWithoutRolesInput>
    connectOrCreate?: UserCreateOrConnectWithoutRolesInput
    upsert?: UserUpsertWithoutRolesInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutRolesInput, UserUpdateWithoutRolesInput>, UserUncheckedUpdateWithoutRolesInput>
  }

  export type UserUpdateOneWithoutAssignedRolesNestedInput = {
    create?: XOR<UserCreateWithoutAssignedRolesInput, UserUncheckedCreateWithoutAssignedRolesInput>
    connectOrCreate?: UserCreateOrConnectWithoutAssignedRolesInput
    upsert?: UserUpsertWithoutAssignedRolesInput
    disconnect?: UserWhereInput | boolean
    delete?: UserWhereInput | boolean
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutAssignedRolesInput, UserUpdateWithoutAssignedRolesInput>, UserUncheckedUpdateWithoutAssignedRolesInput>
  }

  export type UserCreateNestedOneWithoutAuthTokensInput = {
    create?: XOR<UserCreateWithoutAuthTokensInput, UserUncheckedCreateWithoutAuthTokensInput>
    connectOrCreate?: UserCreateOrConnectWithoutAuthTokensInput
    connect?: UserWhereUniqueInput
  }

  export type EnumAuthTokenTypeFieldUpdateOperationsInput = {
    set?: $Enums.AuthTokenType
  }

  export type UserUpdateOneRequiredWithoutAuthTokensNestedInput = {
    create?: XOR<UserCreateWithoutAuthTokensInput, UserUncheckedCreateWithoutAuthTokensInput>
    connectOrCreate?: UserCreateOrConnectWithoutAuthTokensInput
    upsert?: UserUpsertWithoutAuthTokensInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutAuthTokensInput, UserUpdateWithoutAuthTokensInput>, UserUncheckedUpdateWithoutAuthTokensInput>
  }

  export type UserCreateNestedOneWithoutInvitedRolesInput = {
    create?: XOR<UserCreateWithoutInvitedRolesInput, UserUncheckedCreateWithoutInvitedRolesInput>
    connectOrCreate?: UserCreateOrConnectWithoutInvitedRolesInput
    connect?: UserWhereUniqueInput
  }

  export type UserCreateNestedOneWithoutUsedInvitationsInput = {
    create?: XOR<UserCreateWithoutUsedInvitationsInput, UserUncheckedCreateWithoutUsedInvitationsInput>
    connectOrCreate?: UserCreateOrConnectWithoutUsedInvitationsInput
    connect?: UserWhereUniqueInput
  }

  export type EnumRoleInvitationTargetRoleFieldUpdateOperationsInput = {
    set?: $Enums.RoleInvitationTargetRole
  }

  export type EnumRoleInvitationStatusFieldUpdateOperationsInput = {
    set?: $Enums.RoleInvitationStatus
  }

  export type UserUpdateOneWithoutInvitedRolesNestedInput = {
    create?: XOR<UserCreateWithoutInvitedRolesInput, UserUncheckedCreateWithoutInvitedRolesInput>
    connectOrCreate?: UserCreateOrConnectWithoutInvitedRolesInput
    upsert?: UserUpsertWithoutInvitedRolesInput
    disconnect?: UserWhereInput | boolean
    delete?: UserWhereInput | boolean
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutInvitedRolesInput, UserUpdateWithoutInvitedRolesInput>, UserUncheckedUpdateWithoutInvitedRolesInput>
  }

  export type UserUpdateOneWithoutUsedInvitationsNestedInput = {
    create?: XOR<UserCreateWithoutUsedInvitationsInput, UserUncheckedCreateWithoutUsedInvitationsInput>
    connectOrCreate?: UserCreateOrConnectWithoutUsedInvitationsInput
    upsert?: UserUpsertWithoutUsedInvitationsInput
    disconnect?: UserWhereInput | boolean
    delete?: UserWhereInput | boolean
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutUsedInvitationsInput, UserUpdateWithoutUsedInvitationsInput>, UserUncheckedUpdateWithoutUsedInvitationsInput>
  }

  export type LearnerProfileCreateinterestsInput = {
    set: string[]
  }

  export type UserCreateNestedOneWithoutLearnerProfileInput = {
    create?: XOR<UserCreateWithoutLearnerProfileInput, UserUncheckedCreateWithoutLearnerProfileInput>
    connectOrCreate?: UserCreateOrConnectWithoutLearnerProfileInput
    connect?: UserWhereUniqueInput
  }

  export type LearnerProfileUpdateinterestsInput = {
    set?: string[]
    push?: string | string[]
  }

  export type UserUpdateOneRequiredWithoutLearnerProfileNestedInput = {
    create?: XOR<UserCreateWithoutLearnerProfileInput, UserUncheckedCreateWithoutLearnerProfileInput>
    connectOrCreate?: UserCreateOrConnectWithoutLearnerProfileInput
    upsert?: UserUpsertWithoutLearnerProfileInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutLearnerProfileInput, UserUpdateWithoutLearnerProfileInput>, UserUncheckedUpdateWithoutLearnerProfileInput>
  }

  export type UserCreateNestedOneWithoutSupplierProfileInput = {
    create?: XOR<UserCreateWithoutSupplierProfileInput, UserUncheckedCreateWithoutSupplierProfileInput>
    connectOrCreate?: UserCreateOrConnectWithoutSupplierProfileInput
    connect?: UserWhereUniqueInput
  }

  export type LocationCreateNestedOneWithoutSupplierPickupForInput = {
    create?: XOR<LocationCreateWithoutSupplierPickupForInput, LocationUncheckedCreateWithoutSupplierPickupForInput>
    connectOrCreate?: LocationCreateOrConnectWithoutSupplierPickupForInput
    connect?: LocationWhereUniqueInput
  }

  export type UserUpdateOneRequiredWithoutSupplierProfileNestedInput = {
    create?: XOR<UserCreateWithoutSupplierProfileInput, UserUncheckedCreateWithoutSupplierProfileInput>
    connectOrCreate?: UserCreateOrConnectWithoutSupplierProfileInput
    upsert?: UserUpsertWithoutSupplierProfileInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutSupplierProfileInput, UserUpdateWithoutSupplierProfileInput>, UserUncheckedUpdateWithoutSupplierProfileInput>
  }

  export type LocationUpdateOneWithoutSupplierPickupForNestedInput = {
    create?: XOR<LocationCreateWithoutSupplierPickupForInput, LocationUncheckedCreateWithoutSupplierPickupForInput>
    connectOrCreate?: LocationCreateOrConnectWithoutSupplierPickupForInput
    upsert?: LocationUpsertWithoutSupplierPickupForInput
    disconnect?: LocationWhereInput | boolean
    delete?: LocationWhereInput | boolean
    connect?: LocationWhereUniqueInput
    update?: XOR<XOR<LocationUpdateToOneWithWhereWithoutSupplierPickupForInput, LocationUpdateWithoutSupplierPickupForInput>, LocationUncheckedUpdateWithoutSupplierPickupForInput>
  }

  export type SupplierProfileCreateNestedManyWithoutDefaultPickupLocationInput = {
    create?: XOR<SupplierProfileCreateWithoutDefaultPickupLocationInput, SupplierProfileUncheckedCreateWithoutDefaultPickupLocationInput> | SupplierProfileCreateWithoutDefaultPickupLocationInput[] | SupplierProfileUncheckedCreateWithoutDefaultPickupLocationInput[]
    connectOrCreate?: SupplierProfileCreateOrConnectWithoutDefaultPickupLocationInput | SupplierProfileCreateOrConnectWithoutDefaultPickupLocationInput[]
    createMany?: SupplierProfileCreateManyDefaultPickupLocationInputEnvelope
    connect?: SupplierProfileWhereUniqueInput | SupplierProfileWhereUniqueInput[]
  }

  export type SupplierProfileUncheckedCreateNestedManyWithoutDefaultPickupLocationInput = {
    create?: XOR<SupplierProfileCreateWithoutDefaultPickupLocationInput, SupplierProfileUncheckedCreateWithoutDefaultPickupLocationInput> | SupplierProfileCreateWithoutDefaultPickupLocationInput[] | SupplierProfileUncheckedCreateWithoutDefaultPickupLocationInput[]
    connectOrCreate?: SupplierProfileCreateOrConnectWithoutDefaultPickupLocationInput | SupplierProfileCreateOrConnectWithoutDefaultPickupLocationInput[]
    createMany?: SupplierProfileCreateManyDefaultPickupLocationInputEnvelope
    connect?: SupplierProfileWhereUniqueInput | SupplierProfileWhereUniqueInput[]
  }

  export type NullableDecimalFieldUpdateOperationsInput = {
    set?: Decimal | DecimalJsLike | number | string | null
    increment?: Decimal | DecimalJsLike | number | string
    decrement?: Decimal | DecimalJsLike | number | string
    multiply?: Decimal | DecimalJsLike | number | string
    divide?: Decimal | DecimalJsLike | number | string
  }

  export type SupplierProfileUpdateManyWithoutDefaultPickupLocationNestedInput = {
    create?: XOR<SupplierProfileCreateWithoutDefaultPickupLocationInput, SupplierProfileUncheckedCreateWithoutDefaultPickupLocationInput> | SupplierProfileCreateWithoutDefaultPickupLocationInput[] | SupplierProfileUncheckedCreateWithoutDefaultPickupLocationInput[]
    connectOrCreate?: SupplierProfileCreateOrConnectWithoutDefaultPickupLocationInput | SupplierProfileCreateOrConnectWithoutDefaultPickupLocationInput[]
    upsert?: SupplierProfileUpsertWithWhereUniqueWithoutDefaultPickupLocationInput | SupplierProfileUpsertWithWhereUniqueWithoutDefaultPickupLocationInput[]
    createMany?: SupplierProfileCreateManyDefaultPickupLocationInputEnvelope
    set?: SupplierProfileWhereUniqueInput | SupplierProfileWhereUniqueInput[]
    disconnect?: SupplierProfileWhereUniqueInput | SupplierProfileWhereUniqueInput[]
    delete?: SupplierProfileWhereUniqueInput | SupplierProfileWhereUniqueInput[]
    connect?: SupplierProfileWhereUniqueInput | SupplierProfileWhereUniqueInput[]
    update?: SupplierProfileUpdateWithWhereUniqueWithoutDefaultPickupLocationInput | SupplierProfileUpdateWithWhereUniqueWithoutDefaultPickupLocationInput[]
    updateMany?: SupplierProfileUpdateManyWithWhereWithoutDefaultPickupLocationInput | SupplierProfileUpdateManyWithWhereWithoutDefaultPickupLocationInput[]
    deleteMany?: SupplierProfileScalarWhereInput | SupplierProfileScalarWhereInput[]
  }

  export type SupplierProfileUncheckedUpdateManyWithoutDefaultPickupLocationNestedInput = {
    create?: XOR<SupplierProfileCreateWithoutDefaultPickupLocationInput, SupplierProfileUncheckedCreateWithoutDefaultPickupLocationInput> | SupplierProfileCreateWithoutDefaultPickupLocationInput[] | SupplierProfileUncheckedCreateWithoutDefaultPickupLocationInput[]
    connectOrCreate?: SupplierProfileCreateOrConnectWithoutDefaultPickupLocationInput | SupplierProfileCreateOrConnectWithoutDefaultPickupLocationInput[]
    upsert?: SupplierProfileUpsertWithWhereUniqueWithoutDefaultPickupLocationInput | SupplierProfileUpsertWithWhereUniqueWithoutDefaultPickupLocationInput[]
    createMany?: SupplierProfileCreateManyDefaultPickupLocationInputEnvelope
    set?: SupplierProfileWhereUniqueInput | SupplierProfileWhereUniqueInput[]
    disconnect?: SupplierProfileWhereUniqueInput | SupplierProfileWhereUniqueInput[]
    delete?: SupplierProfileWhereUniqueInput | SupplierProfileWhereUniqueInput[]
    connect?: SupplierProfileWhereUniqueInput | SupplierProfileWhereUniqueInput[]
    update?: SupplierProfileUpdateWithWhereUniqueWithoutDefaultPickupLocationInput | SupplierProfileUpdateWithWhereUniqueWithoutDefaultPickupLocationInput[]
    updateMany?: SupplierProfileUpdateManyWithWhereWithoutDefaultPickupLocationInput | SupplierProfileUpdateManyWithWhereWithoutDefaultPickupLocationInput[]
    deleteMany?: SupplierProfileScalarWhereInput | SupplierProfileScalarWhereInput[]
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedEnumAccountStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.AccountStatus | EnumAccountStatusFieldRefInput<$PrismaModel>
    in?: $Enums.AccountStatus[] | ListEnumAccountStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.AccountStatus[] | ListEnumAccountStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumAccountStatusFilter<$PrismaModel> | $Enums.AccountStatus
  }

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedEnumAccountStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.AccountStatus | EnumAccountStatusFieldRefInput<$PrismaModel>
    in?: $Enums.AccountStatus[] | ListEnumAccountStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.AccountStatus[] | ListEnumAccountStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumAccountStatusWithAggregatesFilter<$PrismaModel> | $Enums.AccountStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumAccountStatusFilter<$PrismaModel>
    _max?: NestedEnumAccountStatusFilter<$PrismaModel>
  }

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedEnumUserRoleFilter<$PrismaModel = never> = {
    equals?: $Enums.UserRole | EnumUserRoleFieldRefInput<$PrismaModel>
    in?: $Enums.UserRole[] | ListEnumUserRoleFieldRefInput<$PrismaModel>
    notIn?: $Enums.UserRole[] | ListEnumUserRoleFieldRefInput<$PrismaModel>
    not?: NestedEnumUserRoleFilter<$PrismaModel> | $Enums.UserRole
  }

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type NestedEnumUserRoleWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.UserRole | EnumUserRoleFieldRefInput<$PrismaModel>
    in?: $Enums.UserRole[] | ListEnumUserRoleFieldRefInput<$PrismaModel>
    notIn?: $Enums.UserRole[] | ListEnumUserRoleFieldRefInput<$PrismaModel>
    not?: NestedEnumUserRoleWithAggregatesFilter<$PrismaModel> | $Enums.UserRole
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumUserRoleFilter<$PrismaModel>
    _max?: NestedEnumUserRoleFilter<$PrismaModel>
  }

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type NestedEnumAuthTokenTypeFilter<$PrismaModel = never> = {
    equals?: $Enums.AuthTokenType | EnumAuthTokenTypeFieldRefInput<$PrismaModel>
    in?: $Enums.AuthTokenType[] | ListEnumAuthTokenTypeFieldRefInput<$PrismaModel>
    notIn?: $Enums.AuthTokenType[] | ListEnumAuthTokenTypeFieldRefInput<$PrismaModel>
    not?: NestedEnumAuthTokenTypeFilter<$PrismaModel> | $Enums.AuthTokenType
  }

  export type NestedEnumAuthTokenTypeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.AuthTokenType | EnumAuthTokenTypeFieldRefInput<$PrismaModel>
    in?: $Enums.AuthTokenType[] | ListEnumAuthTokenTypeFieldRefInput<$PrismaModel>
    notIn?: $Enums.AuthTokenType[] | ListEnumAuthTokenTypeFieldRefInput<$PrismaModel>
    not?: NestedEnumAuthTokenTypeWithAggregatesFilter<$PrismaModel> | $Enums.AuthTokenType
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumAuthTokenTypeFilter<$PrismaModel>
    _max?: NestedEnumAuthTokenTypeFilter<$PrismaModel>
  }

  export type NestedEnumRoleInvitationTargetRoleFilter<$PrismaModel = never> = {
    equals?: $Enums.RoleInvitationTargetRole | EnumRoleInvitationTargetRoleFieldRefInput<$PrismaModel>
    in?: $Enums.RoleInvitationTargetRole[] | ListEnumRoleInvitationTargetRoleFieldRefInput<$PrismaModel>
    notIn?: $Enums.RoleInvitationTargetRole[] | ListEnumRoleInvitationTargetRoleFieldRefInput<$PrismaModel>
    not?: NestedEnumRoleInvitationTargetRoleFilter<$PrismaModel> | $Enums.RoleInvitationTargetRole
  }

  export type NestedEnumRoleInvitationStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.RoleInvitationStatus | EnumRoleInvitationStatusFieldRefInput<$PrismaModel>
    in?: $Enums.RoleInvitationStatus[] | ListEnumRoleInvitationStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.RoleInvitationStatus[] | ListEnumRoleInvitationStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumRoleInvitationStatusFilter<$PrismaModel> | $Enums.RoleInvitationStatus
  }

  export type NestedEnumRoleInvitationTargetRoleWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.RoleInvitationTargetRole | EnumRoleInvitationTargetRoleFieldRefInput<$PrismaModel>
    in?: $Enums.RoleInvitationTargetRole[] | ListEnumRoleInvitationTargetRoleFieldRefInput<$PrismaModel>
    notIn?: $Enums.RoleInvitationTargetRole[] | ListEnumRoleInvitationTargetRoleFieldRefInput<$PrismaModel>
    not?: NestedEnumRoleInvitationTargetRoleWithAggregatesFilter<$PrismaModel> | $Enums.RoleInvitationTargetRole
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumRoleInvitationTargetRoleFilter<$PrismaModel>
    _max?: NestedEnumRoleInvitationTargetRoleFilter<$PrismaModel>
  }

  export type NestedEnumRoleInvitationStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.RoleInvitationStatus | EnumRoleInvitationStatusFieldRefInput<$PrismaModel>
    in?: $Enums.RoleInvitationStatus[] | ListEnumRoleInvitationStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.RoleInvitationStatus[] | ListEnumRoleInvitationStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumRoleInvitationStatusWithAggregatesFilter<$PrismaModel> | $Enums.RoleInvitationStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumRoleInvitationStatusFilter<$PrismaModel>
    _max?: NestedEnumRoleInvitationStatusFilter<$PrismaModel>
  }

  export type NestedDecimalNullableFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel> | null
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalNullableFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string | null
  }

  export type NestedDecimalNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel> | null
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalNullableWithAggregatesFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedDecimalNullableFilter<$PrismaModel>
    _sum?: NestedDecimalNullableFilter<$PrismaModel>
    _min?: NestedDecimalNullableFilter<$PrismaModel>
    _max?: NestedDecimalNullableFilter<$PrismaModel>
  }

  export type UserRoleAssignmentCreateWithoutUserInput = {
    id?: string
    role: $Enums.UserRole
    isPrimary?: boolean
    createdAt?: Date | string
    assignedByUser?: UserCreateNestedOneWithoutAssignedRolesInput
  }

  export type UserRoleAssignmentUncheckedCreateWithoutUserInput = {
    id?: string
    role: $Enums.UserRole
    isPrimary?: boolean
    assignedBy?: string | null
    createdAt?: Date | string
  }

  export type UserRoleAssignmentCreateOrConnectWithoutUserInput = {
    where: UserRoleAssignmentWhereUniqueInput
    create: XOR<UserRoleAssignmentCreateWithoutUserInput, UserRoleAssignmentUncheckedCreateWithoutUserInput>
  }

  export type UserRoleAssignmentCreateManyUserInputEnvelope = {
    data: UserRoleAssignmentCreateManyUserInput | UserRoleAssignmentCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type AuthTokenCreateWithoutUserInput = {
    id?: string
    tokenHash: string
    tokenType: $Enums.AuthTokenType
    target: string
    expiresAt: Date | string
    usedAt?: Date | string | null
    createdAt?: Date | string
  }

  export type AuthTokenUncheckedCreateWithoutUserInput = {
    id?: string
    tokenHash: string
    tokenType: $Enums.AuthTokenType
    target: string
    expiresAt: Date | string
    usedAt?: Date | string | null
    createdAt?: Date | string
  }

  export type AuthTokenCreateOrConnectWithoutUserInput = {
    where: AuthTokenWhereUniqueInput
    create: XOR<AuthTokenCreateWithoutUserInput, AuthTokenUncheckedCreateWithoutUserInput>
  }

  export type AuthTokenCreateManyUserInputEnvelope = {
    data: AuthTokenCreateManyUserInput | AuthTokenCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type LearnerProfileCreateWithoutUserInput = {
    id?: string
    learnerType?: string | null
    bio?: string | null
    interests?: LearnerProfileCreateinterestsInput | string[]
    skillLevel?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type LearnerProfileUncheckedCreateWithoutUserInput = {
    id?: string
    learnerType?: string | null
    bio?: string | null
    interests?: LearnerProfileCreateinterestsInput | string[]
    skillLevel?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type LearnerProfileCreateOrConnectWithoutUserInput = {
    where: LearnerProfileWhereUniqueInput
    create: XOR<LearnerProfileCreateWithoutUserInput, LearnerProfileUncheckedCreateWithoutUserInput>
  }

  export type SupplierProfileCreateWithoutUserInput = {
    id?: string
    supplierType?: string | null
    publicName?: string | null
    description?: string | null
    verificationStatus?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    defaultPickupLocation?: LocationCreateNestedOneWithoutSupplierPickupForInput
  }

  export type SupplierProfileUncheckedCreateWithoutUserInput = {
    id?: string
    supplierType?: string | null
    publicName?: string | null
    description?: string | null
    verificationStatus?: string
    defaultPickupLocationId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type SupplierProfileCreateOrConnectWithoutUserInput = {
    where: SupplierProfileWhereUniqueInput
    create: XOR<SupplierProfileCreateWithoutUserInput, SupplierProfileUncheckedCreateWithoutUserInput>
  }

  export type RoleInvitationCreateWithoutInvitedByUserInput = {
    id?: string
    targetEmail?: string | null
    targetPhone?: string | null
    targetRole: $Enums.RoleInvitationTargetRole
    tokenHash: string
    status?: $Enums.RoleInvitationStatus
    expiresAt: Date | string
    usedAt?: Date | string | null
    notes?: string | null
    createdAt?: Date | string
    usedByUser?: UserCreateNestedOneWithoutUsedInvitationsInput
  }

  export type RoleInvitationUncheckedCreateWithoutInvitedByUserInput = {
    id?: string
    targetEmail?: string | null
    targetPhone?: string | null
    targetRole: $Enums.RoleInvitationTargetRole
    tokenHash: string
    status?: $Enums.RoleInvitationStatus
    expiresAt: Date | string
    usedAt?: Date | string | null
    usedByUserId?: string | null
    notes?: string | null
    createdAt?: Date | string
  }

  export type RoleInvitationCreateOrConnectWithoutInvitedByUserInput = {
    where: RoleInvitationWhereUniqueInput
    create: XOR<RoleInvitationCreateWithoutInvitedByUserInput, RoleInvitationUncheckedCreateWithoutInvitedByUserInput>
  }

  export type RoleInvitationCreateManyInvitedByUserInputEnvelope = {
    data: RoleInvitationCreateManyInvitedByUserInput | RoleInvitationCreateManyInvitedByUserInput[]
    skipDuplicates?: boolean
  }

  export type RoleInvitationCreateWithoutUsedByUserInput = {
    id?: string
    targetEmail?: string | null
    targetPhone?: string | null
    targetRole: $Enums.RoleInvitationTargetRole
    tokenHash: string
    status?: $Enums.RoleInvitationStatus
    expiresAt: Date | string
    usedAt?: Date | string | null
    notes?: string | null
    createdAt?: Date | string
    invitedByUser?: UserCreateNestedOneWithoutInvitedRolesInput
  }

  export type RoleInvitationUncheckedCreateWithoutUsedByUserInput = {
    id?: string
    targetEmail?: string | null
    targetPhone?: string | null
    targetRole: $Enums.RoleInvitationTargetRole
    tokenHash: string
    invitedBy?: string | null
    status?: $Enums.RoleInvitationStatus
    expiresAt: Date | string
    usedAt?: Date | string | null
    notes?: string | null
    createdAt?: Date | string
  }

  export type RoleInvitationCreateOrConnectWithoutUsedByUserInput = {
    where: RoleInvitationWhereUniqueInput
    create: XOR<RoleInvitationCreateWithoutUsedByUserInput, RoleInvitationUncheckedCreateWithoutUsedByUserInput>
  }

  export type RoleInvitationCreateManyUsedByUserInputEnvelope = {
    data: RoleInvitationCreateManyUsedByUserInput | RoleInvitationCreateManyUsedByUserInput[]
    skipDuplicates?: boolean
  }

  export type UserRoleAssignmentCreateWithoutAssignedByUserInput = {
    id?: string
    role: $Enums.UserRole
    isPrimary?: boolean
    createdAt?: Date | string
    user: UserCreateNestedOneWithoutRolesInput
  }

  export type UserRoleAssignmentUncheckedCreateWithoutAssignedByUserInput = {
    id?: string
    userId: string
    role: $Enums.UserRole
    isPrimary?: boolean
    createdAt?: Date | string
  }

  export type UserRoleAssignmentCreateOrConnectWithoutAssignedByUserInput = {
    where: UserRoleAssignmentWhereUniqueInput
    create: XOR<UserRoleAssignmentCreateWithoutAssignedByUserInput, UserRoleAssignmentUncheckedCreateWithoutAssignedByUserInput>
  }

  export type UserRoleAssignmentCreateManyAssignedByUserInputEnvelope = {
    data: UserRoleAssignmentCreateManyAssignedByUserInput | UserRoleAssignmentCreateManyAssignedByUserInput[]
    skipDuplicates?: boolean
  }

  export type UserRoleAssignmentUpsertWithWhereUniqueWithoutUserInput = {
    where: UserRoleAssignmentWhereUniqueInput
    update: XOR<UserRoleAssignmentUpdateWithoutUserInput, UserRoleAssignmentUncheckedUpdateWithoutUserInput>
    create: XOR<UserRoleAssignmentCreateWithoutUserInput, UserRoleAssignmentUncheckedCreateWithoutUserInput>
  }

  export type UserRoleAssignmentUpdateWithWhereUniqueWithoutUserInput = {
    where: UserRoleAssignmentWhereUniqueInput
    data: XOR<UserRoleAssignmentUpdateWithoutUserInput, UserRoleAssignmentUncheckedUpdateWithoutUserInput>
  }

  export type UserRoleAssignmentUpdateManyWithWhereWithoutUserInput = {
    where: UserRoleAssignmentScalarWhereInput
    data: XOR<UserRoleAssignmentUpdateManyMutationInput, UserRoleAssignmentUncheckedUpdateManyWithoutUserInput>
  }

  export type UserRoleAssignmentScalarWhereInput = {
    AND?: UserRoleAssignmentScalarWhereInput | UserRoleAssignmentScalarWhereInput[]
    OR?: UserRoleAssignmentScalarWhereInput[]
    NOT?: UserRoleAssignmentScalarWhereInput | UserRoleAssignmentScalarWhereInput[]
    id?: StringFilter<"UserRoleAssignment"> | string
    userId?: StringFilter<"UserRoleAssignment"> | string
    role?: EnumUserRoleFilter<"UserRoleAssignment"> | $Enums.UserRole
    isPrimary?: BoolFilter<"UserRoleAssignment"> | boolean
    assignedBy?: StringNullableFilter<"UserRoleAssignment"> | string | null
    createdAt?: DateTimeFilter<"UserRoleAssignment"> | Date | string
  }

  export type AuthTokenUpsertWithWhereUniqueWithoutUserInput = {
    where: AuthTokenWhereUniqueInput
    update: XOR<AuthTokenUpdateWithoutUserInput, AuthTokenUncheckedUpdateWithoutUserInput>
    create: XOR<AuthTokenCreateWithoutUserInput, AuthTokenUncheckedCreateWithoutUserInput>
  }

  export type AuthTokenUpdateWithWhereUniqueWithoutUserInput = {
    where: AuthTokenWhereUniqueInput
    data: XOR<AuthTokenUpdateWithoutUserInput, AuthTokenUncheckedUpdateWithoutUserInput>
  }

  export type AuthTokenUpdateManyWithWhereWithoutUserInput = {
    where: AuthTokenScalarWhereInput
    data: XOR<AuthTokenUpdateManyMutationInput, AuthTokenUncheckedUpdateManyWithoutUserInput>
  }

  export type AuthTokenScalarWhereInput = {
    AND?: AuthTokenScalarWhereInput | AuthTokenScalarWhereInput[]
    OR?: AuthTokenScalarWhereInput[]
    NOT?: AuthTokenScalarWhereInput | AuthTokenScalarWhereInput[]
    id?: StringFilter<"AuthToken"> | string
    userId?: StringFilter<"AuthToken"> | string
    tokenHash?: StringFilter<"AuthToken"> | string
    tokenType?: EnumAuthTokenTypeFilter<"AuthToken"> | $Enums.AuthTokenType
    target?: StringFilter<"AuthToken"> | string
    expiresAt?: DateTimeFilter<"AuthToken"> | Date | string
    usedAt?: DateTimeNullableFilter<"AuthToken"> | Date | string | null
    createdAt?: DateTimeFilter<"AuthToken"> | Date | string
  }

  export type LearnerProfileUpsertWithoutUserInput = {
    update: XOR<LearnerProfileUpdateWithoutUserInput, LearnerProfileUncheckedUpdateWithoutUserInput>
    create: XOR<LearnerProfileCreateWithoutUserInput, LearnerProfileUncheckedCreateWithoutUserInput>
    where?: LearnerProfileWhereInput
  }

  export type LearnerProfileUpdateToOneWithWhereWithoutUserInput = {
    where?: LearnerProfileWhereInput
    data: XOR<LearnerProfileUpdateWithoutUserInput, LearnerProfileUncheckedUpdateWithoutUserInput>
  }

  export type LearnerProfileUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    learnerType?: NullableStringFieldUpdateOperationsInput | string | null
    bio?: NullableStringFieldUpdateOperationsInput | string | null
    interests?: LearnerProfileUpdateinterestsInput | string[]
    skillLevel?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type LearnerProfileUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    learnerType?: NullableStringFieldUpdateOperationsInput | string | null
    bio?: NullableStringFieldUpdateOperationsInput | string | null
    interests?: LearnerProfileUpdateinterestsInput | string[]
    skillLevel?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SupplierProfileUpsertWithoutUserInput = {
    update: XOR<SupplierProfileUpdateWithoutUserInput, SupplierProfileUncheckedUpdateWithoutUserInput>
    create: XOR<SupplierProfileCreateWithoutUserInput, SupplierProfileUncheckedCreateWithoutUserInput>
    where?: SupplierProfileWhereInput
  }

  export type SupplierProfileUpdateToOneWithWhereWithoutUserInput = {
    where?: SupplierProfileWhereInput
    data: XOR<SupplierProfileUpdateWithoutUserInput, SupplierProfileUncheckedUpdateWithoutUserInput>
  }

  export type SupplierProfileUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    supplierType?: NullableStringFieldUpdateOperationsInput | string | null
    publicName?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    verificationStatus?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    defaultPickupLocation?: LocationUpdateOneWithoutSupplierPickupForNestedInput
  }

  export type SupplierProfileUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    supplierType?: NullableStringFieldUpdateOperationsInput | string | null
    publicName?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    verificationStatus?: StringFieldUpdateOperationsInput | string
    defaultPickupLocationId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RoleInvitationUpsertWithWhereUniqueWithoutInvitedByUserInput = {
    where: RoleInvitationWhereUniqueInput
    update: XOR<RoleInvitationUpdateWithoutInvitedByUserInput, RoleInvitationUncheckedUpdateWithoutInvitedByUserInput>
    create: XOR<RoleInvitationCreateWithoutInvitedByUserInput, RoleInvitationUncheckedCreateWithoutInvitedByUserInput>
  }

  export type RoleInvitationUpdateWithWhereUniqueWithoutInvitedByUserInput = {
    where: RoleInvitationWhereUniqueInput
    data: XOR<RoleInvitationUpdateWithoutInvitedByUserInput, RoleInvitationUncheckedUpdateWithoutInvitedByUserInput>
  }

  export type RoleInvitationUpdateManyWithWhereWithoutInvitedByUserInput = {
    where: RoleInvitationScalarWhereInput
    data: XOR<RoleInvitationUpdateManyMutationInput, RoleInvitationUncheckedUpdateManyWithoutInvitedByUserInput>
  }

  export type RoleInvitationScalarWhereInput = {
    AND?: RoleInvitationScalarWhereInput | RoleInvitationScalarWhereInput[]
    OR?: RoleInvitationScalarWhereInput[]
    NOT?: RoleInvitationScalarWhereInput | RoleInvitationScalarWhereInput[]
    id?: StringFilter<"RoleInvitation"> | string
    targetEmail?: StringNullableFilter<"RoleInvitation"> | string | null
    targetPhone?: StringNullableFilter<"RoleInvitation"> | string | null
    targetRole?: EnumRoleInvitationTargetRoleFilter<"RoleInvitation"> | $Enums.RoleInvitationTargetRole
    tokenHash?: StringFilter<"RoleInvitation"> | string
    invitedBy?: StringNullableFilter<"RoleInvitation"> | string | null
    status?: EnumRoleInvitationStatusFilter<"RoleInvitation"> | $Enums.RoleInvitationStatus
    expiresAt?: DateTimeFilter<"RoleInvitation"> | Date | string
    usedAt?: DateTimeNullableFilter<"RoleInvitation"> | Date | string | null
    usedByUserId?: StringNullableFilter<"RoleInvitation"> | string | null
    notes?: StringNullableFilter<"RoleInvitation"> | string | null
    createdAt?: DateTimeFilter<"RoleInvitation"> | Date | string
  }

  export type RoleInvitationUpsertWithWhereUniqueWithoutUsedByUserInput = {
    where: RoleInvitationWhereUniqueInput
    update: XOR<RoleInvitationUpdateWithoutUsedByUserInput, RoleInvitationUncheckedUpdateWithoutUsedByUserInput>
    create: XOR<RoleInvitationCreateWithoutUsedByUserInput, RoleInvitationUncheckedCreateWithoutUsedByUserInput>
  }

  export type RoleInvitationUpdateWithWhereUniqueWithoutUsedByUserInput = {
    where: RoleInvitationWhereUniqueInput
    data: XOR<RoleInvitationUpdateWithoutUsedByUserInput, RoleInvitationUncheckedUpdateWithoutUsedByUserInput>
  }

  export type RoleInvitationUpdateManyWithWhereWithoutUsedByUserInput = {
    where: RoleInvitationScalarWhereInput
    data: XOR<RoleInvitationUpdateManyMutationInput, RoleInvitationUncheckedUpdateManyWithoutUsedByUserInput>
  }

  export type UserRoleAssignmentUpsertWithWhereUniqueWithoutAssignedByUserInput = {
    where: UserRoleAssignmentWhereUniqueInput
    update: XOR<UserRoleAssignmentUpdateWithoutAssignedByUserInput, UserRoleAssignmentUncheckedUpdateWithoutAssignedByUserInput>
    create: XOR<UserRoleAssignmentCreateWithoutAssignedByUserInput, UserRoleAssignmentUncheckedCreateWithoutAssignedByUserInput>
  }

  export type UserRoleAssignmentUpdateWithWhereUniqueWithoutAssignedByUserInput = {
    where: UserRoleAssignmentWhereUniqueInput
    data: XOR<UserRoleAssignmentUpdateWithoutAssignedByUserInput, UserRoleAssignmentUncheckedUpdateWithoutAssignedByUserInput>
  }

  export type UserRoleAssignmentUpdateManyWithWhereWithoutAssignedByUserInput = {
    where: UserRoleAssignmentScalarWhereInput
    data: XOR<UserRoleAssignmentUpdateManyMutationInput, UserRoleAssignmentUncheckedUpdateManyWithoutAssignedByUserInput>
  }

  export type UserCreateWithoutRolesInput = {
    id?: string
    displayName: string
    email: string
    phone?: string | null
    passwordHash: string
    accountStatus?: $Enums.AccountStatus
    profileImageUrl?: string | null
    emailVerifiedAt?: Date | string | null
    phoneVerifiedAt?: Date | string | null
    lastLoginAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    authTokens?: AuthTokenCreateNestedManyWithoutUserInput
    learnerProfile?: LearnerProfileCreateNestedOneWithoutUserInput
    supplierProfile?: SupplierProfileCreateNestedOneWithoutUserInput
    invitedRoles?: RoleInvitationCreateNestedManyWithoutInvitedByUserInput
    usedInvitations?: RoleInvitationCreateNestedManyWithoutUsedByUserInput
    assignedRoles?: UserRoleAssignmentCreateNestedManyWithoutAssignedByUserInput
  }

  export type UserUncheckedCreateWithoutRolesInput = {
    id?: string
    displayName: string
    email: string
    phone?: string | null
    passwordHash: string
    accountStatus?: $Enums.AccountStatus
    profileImageUrl?: string | null
    emailVerifiedAt?: Date | string | null
    phoneVerifiedAt?: Date | string | null
    lastLoginAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    authTokens?: AuthTokenUncheckedCreateNestedManyWithoutUserInput
    learnerProfile?: LearnerProfileUncheckedCreateNestedOneWithoutUserInput
    supplierProfile?: SupplierProfileUncheckedCreateNestedOneWithoutUserInput
    invitedRoles?: RoleInvitationUncheckedCreateNestedManyWithoutInvitedByUserInput
    usedInvitations?: RoleInvitationUncheckedCreateNestedManyWithoutUsedByUserInput
    assignedRoles?: UserRoleAssignmentUncheckedCreateNestedManyWithoutAssignedByUserInput
  }

  export type UserCreateOrConnectWithoutRolesInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutRolesInput, UserUncheckedCreateWithoutRolesInput>
  }

  export type UserCreateWithoutAssignedRolesInput = {
    id?: string
    displayName: string
    email: string
    phone?: string | null
    passwordHash: string
    accountStatus?: $Enums.AccountStatus
    profileImageUrl?: string | null
    emailVerifiedAt?: Date | string | null
    phoneVerifiedAt?: Date | string | null
    lastLoginAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    roles?: UserRoleAssignmentCreateNestedManyWithoutUserInput
    authTokens?: AuthTokenCreateNestedManyWithoutUserInput
    learnerProfile?: LearnerProfileCreateNestedOneWithoutUserInput
    supplierProfile?: SupplierProfileCreateNestedOneWithoutUserInput
    invitedRoles?: RoleInvitationCreateNestedManyWithoutInvitedByUserInput
    usedInvitations?: RoleInvitationCreateNestedManyWithoutUsedByUserInput
  }

  export type UserUncheckedCreateWithoutAssignedRolesInput = {
    id?: string
    displayName: string
    email: string
    phone?: string | null
    passwordHash: string
    accountStatus?: $Enums.AccountStatus
    profileImageUrl?: string | null
    emailVerifiedAt?: Date | string | null
    phoneVerifiedAt?: Date | string | null
    lastLoginAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    roles?: UserRoleAssignmentUncheckedCreateNestedManyWithoutUserInput
    authTokens?: AuthTokenUncheckedCreateNestedManyWithoutUserInput
    learnerProfile?: LearnerProfileUncheckedCreateNestedOneWithoutUserInput
    supplierProfile?: SupplierProfileUncheckedCreateNestedOneWithoutUserInput
    invitedRoles?: RoleInvitationUncheckedCreateNestedManyWithoutInvitedByUserInput
    usedInvitations?: RoleInvitationUncheckedCreateNestedManyWithoutUsedByUserInput
  }

  export type UserCreateOrConnectWithoutAssignedRolesInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutAssignedRolesInput, UserUncheckedCreateWithoutAssignedRolesInput>
  }

  export type UserUpsertWithoutRolesInput = {
    update: XOR<UserUpdateWithoutRolesInput, UserUncheckedUpdateWithoutRolesInput>
    create: XOR<UserCreateWithoutRolesInput, UserUncheckedCreateWithoutRolesInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutRolesInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutRolesInput, UserUncheckedUpdateWithoutRolesInput>
  }

  export type UserUpdateWithoutRolesInput = {
    id?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    passwordHash?: StringFieldUpdateOperationsInput | string
    accountStatus?: EnumAccountStatusFieldUpdateOperationsInput | $Enums.AccountStatus
    profileImageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    phoneVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    authTokens?: AuthTokenUpdateManyWithoutUserNestedInput
    learnerProfile?: LearnerProfileUpdateOneWithoutUserNestedInput
    supplierProfile?: SupplierProfileUpdateOneWithoutUserNestedInput
    invitedRoles?: RoleInvitationUpdateManyWithoutInvitedByUserNestedInput
    usedInvitations?: RoleInvitationUpdateManyWithoutUsedByUserNestedInput
    assignedRoles?: UserRoleAssignmentUpdateManyWithoutAssignedByUserNestedInput
  }

  export type UserUncheckedUpdateWithoutRolesInput = {
    id?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    passwordHash?: StringFieldUpdateOperationsInput | string
    accountStatus?: EnumAccountStatusFieldUpdateOperationsInput | $Enums.AccountStatus
    profileImageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    phoneVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    authTokens?: AuthTokenUncheckedUpdateManyWithoutUserNestedInput
    learnerProfile?: LearnerProfileUncheckedUpdateOneWithoutUserNestedInput
    supplierProfile?: SupplierProfileUncheckedUpdateOneWithoutUserNestedInput
    invitedRoles?: RoleInvitationUncheckedUpdateManyWithoutInvitedByUserNestedInput
    usedInvitations?: RoleInvitationUncheckedUpdateManyWithoutUsedByUserNestedInput
    assignedRoles?: UserRoleAssignmentUncheckedUpdateManyWithoutAssignedByUserNestedInput
  }

  export type UserUpsertWithoutAssignedRolesInput = {
    update: XOR<UserUpdateWithoutAssignedRolesInput, UserUncheckedUpdateWithoutAssignedRolesInput>
    create: XOR<UserCreateWithoutAssignedRolesInput, UserUncheckedCreateWithoutAssignedRolesInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutAssignedRolesInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutAssignedRolesInput, UserUncheckedUpdateWithoutAssignedRolesInput>
  }

  export type UserUpdateWithoutAssignedRolesInput = {
    id?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    passwordHash?: StringFieldUpdateOperationsInput | string
    accountStatus?: EnumAccountStatusFieldUpdateOperationsInput | $Enums.AccountStatus
    profileImageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    phoneVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    roles?: UserRoleAssignmentUpdateManyWithoutUserNestedInput
    authTokens?: AuthTokenUpdateManyWithoutUserNestedInput
    learnerProfile?: LearnerProfileUpdateOneWithoutUserNestedInput
    supplierProfile?: SupplierProfileUpdateOneWithoutUserNestedInput
    invitedRoles?: RoleInvitationUpdateManyWithoutInvitedByUserNestedInput
    usedInvitations?: RoleInvitationUpdateManyWithoutUsedByUserNestedInput
  }

  export type UserUncheckedUpdateWithoutAssignedRolesInput = {
    id?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    passwordHash?: StringFieldUpdateOperationsInput | string
    accountStatus?: EnumAccountStatusFieldUpdateOperationsInput | $Enums.AccountStatus
    profileImageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    phoneVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    roles?: UserRoleAssignmentUncheckedUpdateManyWithoutUserNestedInput
    authTokens?: AuthTokenUncheckedUpdateManyWithoutUserNestedInput
    learnerProfile?: LearnerProfileUncheckedUpdateOneWithoutUserNestedInput
    supplierProfile?: SupplierProfileUncheckedUpdateOneWithoutUserNestedInput
    invitedRoles?: RoleInvitationUncheckedUpdateManyWithoutInvitedByUserNestedInput
    usedInvitations?: RoleInvitationUncheckedUpdateManyWithoutUsedByUserNestedInput
  }

  export type UserCreateWithoutAuthTokensInput = {
    id?: string
    displayName: string
    email: string
    phone?: string | null
    passwordHash: string
    accountStatus?: $Enums.AccountStatus
    profileImageUrl?: string | null
    emailVerifiedAt?: Date | string | null
    phoneVerifiedAt?: Date | string | null
    lastLoginAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    roles?: UserRoleAssignmentCreateNestedManyWithoutUserInput
    learnerProfile?: LearnerProfileCreateNestedOneWithoutUserInput
    supplierProfile?: SupplierProfileCreateNestedOneWithoutUserInput
    invitedRoles?: RoleInvitationCreateNestedManyWithoutInvitedByUserInput
    usedInvitations?: RoleInvitationCreateNestedManyWithoutUsedByUserInput
    assignedRoles?: UserRoleAssignmentCreateNestedManyWithoutAssignedByUserInput
  }

  export type UserUncheckedCreateWithoutAuthTokensInput = {
    id?: string
    displayName: string
    email: string
    phone?: string | null
    passwordHash: string
    accountStatus?: $Enums.AccountStatus
    profileImageUrl?: string | null
    emailVerifiedAt?: Date | string | null
    phoneVerifiedAt?: Date | string | null
    lastLoginAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    roles?: UserRoleAssignmentUncheckedCreateNestedManyWithoutUserInput
    learnerProfile?: LearnerProfileUncheckedCreateNestedOneWithoutUserInput
    supplierProfile?: SupplierProfileUncheckedCreateNestedOneWithoutUserInput
    invitedRoles?: RoleInvitationUncheckedCreateNestedManyWithoutInvitedByUserInput
    usedInvitations?: RoleInvitationUncheckedCreateNestedManyWithoutUsedByUserInput
    assignedRoles?: UserRoleAssignmentUncheckedCreateNestedManyWithoutAssignedByUserInput
  }

  export type UserCreateOrConnectWithoutAuthTokensInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutAuthTokensInput, UserUncheckedCreateWithoutAuthTokensInput>
  }

  export type UserUpsertWithoutAuthTokensInput = {
    update: XOR<UserUpdateWithoutAuthTokensInput, UserUncheckedUpdateWithoutAuthTokensInput>
    create: XOR<UserCreateWithoutAuthTokensInput, UserUncheckedCreateWithoutAuthTokensInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutAuthTokensInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutAuthTokensInput, UserUncheckedUpdateWithoutAuthTokensInput>
  }

  export type UserUpdateWithoutAuthTokensInput = {
    id?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    passwordHash?: StringFieldUpdateOperationsInput | string
    accountStatus?: EnumAccountStatusFieldUpdateOperationsInput | $Enums.AccountStatus
    profileImageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    phoneVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    roles?: UserRoleAssignmentUpdateManyWithoutUserNestedInput
    learnerProfile?: LearnerProfileUpdateOneWithoutUserNestedInput
    supplierProfile?: SupplierProfileUpdateOneWithoutUserNestedInput
    invitedRoles?: RoleInvitationUpdateManyWithoutInvitedByUserNestedInput
    usedInvitations?: RoleInvitationUpdateManyWithoutUsedByUserNestedInput
    assignedRoles?: UserRoleAssignmentUpdateManyWithoutAssignedByUserNestedInput
  }

  export type UserUncheckedUpdateWithoutAuthTokensInput = {
    id?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    passwordHash?: StringFieldUpdateOperationsInput | string
    accountStatus?: EnumAccountStatusFieldUpdateOperationsInput | $Enums.AccountStatus
    profileImageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    phoneVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    roles?: UserRoleAssignmentUncheckedUpdateManyWithoutUserNestedInput
    learnerProfile?: LearnerProfileUncheckedUpdateOneWithoutUserNestedInput
    supplierProfile?: SupplierProfileUncheckedUpdateOneWithoutUserNestedInput
    invitedRoles?: RoleInvitationUncheckedUpdateManyWithoutInvitedByUserNestedInput
    usedInvitations?: RoleInvitationUncheckedUpdateManyWithoutUsedByUserNestedInput
    assignedRoles?: UserRoleAssignmentUncheckedUpdateManyWithoutAssignedByUserNestedInput
  }

  export type UserCreateWithoutInvitedRolesInput = {
    id?: string
    displayName: string
    email: string
    phone?: string | null
    passwordHash: string
    accountStatus?: $Enums.AccountStatus
    profileImageUrl?: string | null
    emailVerifiedAt?: Date | string | null
    phoneVerifiedAt?: Date | string | null
    lastLoginAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    roles?: UserRoleAssignmentCreateNestedManyWithoutUserInput
    authTokens?: AuthTokenCreateNestedManyWithoutUserInput
    learnerProfile?: LearnerProfileCreateNestedOneWithoutUserInput
    supplierProfile?: SupplierProfileCreateNestedOneWithoutUserInput
    usedInvitations?: RoleInvitationCreateNestedManyWithoutUsedByUserInput
    assignedRoles?: UserRoleAssignmentCreateNestedManyWithoutAssignedByUserInput
  }

  export type UserUncheckedCreateWithoutInvitedRolesInput = {
    id?: string
    displayName: string
    email: string
    phone?: string | null
    passwordHash: string
    accountStatus?: $Enums.AccountStatus
    profileImageUrl?: string | null
    emailVerifiedAt?: Date | string | null
    phoneVerifiedAt?: Date | string | null
    lastLoginAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    roles?: UserRoleAssignmentUncheckedCreateNestedManyWithoutUserInput
    authTokens?: AuthTokenUncheckedCreateNestedManyWithoutUserInput
    learnerProfile?: LearnerProfileUncheckedCreateNestedOneWithoutUserInput
    supplierProfile?: SupplierProfileUncheckedCreateNestedOneWithoutUserInput
    usedInvitations?: RoleInvitationUncheckedCreateNestedManyWithoutUsedByUserInput
    assignedRoles?: UserRoleAssignmentUncheckedCreateNestedManyWithoutAssignedByUserInput
  }

  export type UserCreateOrConnectWithoutInvitedRolesInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutInvitedRolesInput, UserUncheckedCreateWithoutInvitedRolesInput>
  }

  export type UserCreateWithoutUsedInvitationsInput = {
    id?: string
    displayName: string
    email: string
    phone?: string | null
    passwordHash: string
    accountStatus?: $Enums.AccountStatus
    profileImageUrl?: string | null
    emailVerifiedAt?: Date | string | null
    phoneVerifiedAt?: Date | string | null
    lastLoginAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    roles?: UserRoleAssignmentCreateNestedManyWithoutUserInput
    authTokens?: AuthTokenCreateNestedManyWithoutUserInput
    learnerProfile?: LearnerProfileCreateNestedOneWithoutUserInput
    supplierProfile?: SupplierProfileCreateNestedOneWithoutUserInput
    invitedRoles?: RoleInvitationCreateNestedManyWithoutInvitedByUserInput
    assignedRoles?: UserRoleAssignmentCreateNestedManyWithoutAssignedByUserInput
  }

  export type UserUncheckedCreateWithoutUsedInvitationsInput = {
    id?: string
    displayName: string
    email: string
    phone?: string | null
    passwordHash: string
    accountStatus?: $Enums.AccountStatus
    profileImageUrl?: string | null
    emailVerifiedAt?: Date | string | null
    phoneVerifiedAt?: Date | string | null
    lastLoginAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    roles?: UserRoleAssignmentUncheckedCreateNestedManyWithoutUserInput
    authTokens?: AuthTokenUncheckedCreateNestedManyWithoutUserInput
    learnerProfile?: LearnerProfileUncheckedCreateNestedOneWithoutUserInput
    supplierProfile?: SupplierProfileUncheckedCreateNestedOneWithoutUserInput
    invitedRoles?: RoleInvitationUncheckedCreateNestedManyWithoutInvitedByUserInput
    assignedRoles?: UserRoleAssignmentUncheckedCreateNestedManyWithoutAssignedByUserInput
  }

  export type UserCreateOrConnectWithoutUsedInvitationsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutUsedInvitationsInput, UserUncheckedCreateWithoutUsedInvitationsInput>
  }

  export type UserUpsertWithoutInvitedRolesInput = {
    update: XOR<UserUpdateWithoutInvitedRolesInput, UserUncheckedUpdateWithoutInvitedRolesInput>
    create: XOR<UserCreateWithoutInvitedRolesInput, UserUncheckedCreateWithoutInvitedRolesInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutInvitedRolesInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutInvitedRolesInput, UserUncheckedUpdateWithoutInvitedRolesInput>
  }

  export type UserUpdateWithoutInvitedRolesInput = {
    id?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    passwordHash?: StringFieldUpdateOperationsInput | string
    accountStatus?: EnumAccountStatusFieldUpdateOperationsInput | $Enums.AccountStatus
    profileImageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    phoneVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    roles?: UserRoleAssignmentUpdateManyWithoutUserNestedInput
    authTokens?: AuthTokenUpdateManyWithoutUserNestedInput
    learnerProfile?: LearnerProfileUpdateOneWithoutUserNestedInput
    supplierProfile?: SupplierProfileUpdateOneWithoutUserNestedInput
    usedInvitations?: RoleInvitationUpdateManyWithoutUsedByUserNestedInput
    assignedRoles?: UserRoleAssignmentUpdateManyWithoutAssignedByUserNestedInput
  }

  export type UserUncheckedUpdateWithoutInvitedRolesInput = {
    id?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    passwordHash?: StringFieldUpdateOperationsInput | string
    accountStatus?: EnumAccountStatusFieldUpdateOperationsInput | $Enums.AccountStatus
    profileImageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    phoneVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    roles?: UserRoleAssignmentUncheckedUpdateManyWithoutUserNestedInput
    authTokens?: AuthTokenUncheckedUpdateManyWithoutUserNestedInput
    learnerProfile?: LearnerProfileUncheckedUpdateOneWithoutUserNestedInput
    supplierProfile?: SupplierProfileUncheckedUpdateOneWithoutUserNestedInput
    usedInvitations?: RoleInvitationUncheckedUpdateManyWithoutUsedByUserNestedInput
    assignedRoles?: UserRoleAssignmentUncheckedUpdateManyWithoutAssignedByUserNestedInput
  }

  export type UserUpsertWithoutUsedInvitationsInput = {
    update: XOR<UserUpdateWithoutUsedInvitationsInput, UserUncheckedUpdateWithoutUsedInvitationsInput>
    create: XOR<UserCreateWithoutUsedInvitationsInput, UserUncheckedCreateWithoutUsedInvitationsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutUsedInvitationsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutUsedInvitationsInput, UserUncheckedUpdateWithoutUsedInvitationsInput>
  }

  export type UserUpdateWithoutUsedInvitationsInput = {
    id?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    passwordHash?: StringFieldUpdateOperationsInput | string
    accountStatus?: EnumAccountStatusFieldUpdateOperationsInput | $Enums.AccountStatus
    profileImageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    phoneVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    roles?: UserRoleAssignmentUpdateManyWithoutUserNestedInput
    authTokens?: AuthTokenUpdateManyWithoutUserNestedInput
    learnerProfile?: LearnerProfileUpdateOneWithoutUserNestedInput
    supplierProfile?: SupplierProfileUpdateOneWithoutUserNestedInput
    invitedRoles?: RoleInvitationUpdateManyWithoutInvitedByUserNestedInput
    assignedRoles?: UserRoleAssignmentUpdateManyWithoutAssignedByUserNestedInput
  }

  export type UserUncheckedUpdateWithoutUsedInvitationsInput = {
    id?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    passwordHash?: StringFieldUpdateOperationsInput | string
    accountStatus?: EnumAccountStatusFieldUpdateOperationsInput | $Enums.AccountStatus
    profileImageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    phoneVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    roles?: UserRoleAssignmentUncheckedUpdateManyWithoutUserNestedInput
    authTokens?: AuthTokenUncheckedUpdateManyWithoutUserNestedInput
    learnerProfile?: LearnerProfileUncheckedUpdateOneWithoutUserNestedInput
    supplierProfile?: SupplierProfileUncheckedUpdateOneWithoutUserNestedInput
    invitedRoles?: RoleInvitationUncheckedUpdateManyWithoutInvitedByUserNestedInput
    assignedRoles?: UserRoleAssignmentUncheckedUpdateManyWithoutAssignedByUserNestedInput
  }

  export type UserCreateWithoutLearnerProfileInput = {
    id?: string
    displayName: string
    email: string
    phone?: string | null
    passwordHash: string
    accountStatus?: $Enums.AccountStatus
    profileImageUrl?: string | null
    emailVerifiedAt?: Date | string | null
    phoneVerifiedAt?: Date | string | null
    lastLoginAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    roles?: UserRoleAssignmentCreateNestedManyWithoutUserInput
    authTokens?: AuthTokenCreateNestedManyWithoutUserInput
    supplierProfile?: SupplierProfileCreateNestedOneWithoutUserInput
    invitedRoles?: RoleInvitationCreateNestedManyWithoutInvitedByUserInput
    usedInvitations?: RoleInvitationCreateNestedManyWithoutUsedByUserInput
    assignedRoles?: UserRoleAssignmentCreateNestedManyWithoutAssignedByUserInput
  }

  export type UserUncheckedCreateWithoutLearnerProfileInput = {
    id?: string
    displayName: string
    email: string
    phone?: string | null
    passwordHash: string
    accountStatus?: $Enums.AccountStatus
    profileImageUrl?: string | null
    emailVerifiedAt?: Date | string | null
    phoneVerifiedAt?: Date | string | null
    lastLoginAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    roles?: UserRoleAssignmentUncheckedCreateNestedManyWithoutUserInput
    authTokens?: AuthTokenUncheckedCreateNestedManyWithoutUserInput
    supplierProfile?: SupplierProfileUncheckedCreateNestedOneWithoutUserInput
    invitedRoles?: RoleInvitationUncheckedCreateNestedManyWithoutInvitedByUserInput
    usedInvitations?: RoleInvitationUncheckedCreateNestedManyWithoutUsedByUserInput
    assignedRoles?: UserRoleAssignmentUncheckedCreateNestedManyWithoutAssignedByUserInput
  }

  export type UserCreateOrConnectWithoutLearnerProfileInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutLearnerProfileInput, UserUncheckedCreateWithoutLearnerProfileInput>
  }

  export type UserUpsertWithoutLearnerProfileInput = {
    update: XOR<UserUpdateWithoutLearnerProfileInput, UserUncheckedUpdateWithoutLearnerProfileInput>
    create: XOR<UserCreateWithoutLearnerProfileInput, UserUncheckedCreateWithoutLearnerProfileInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutLearnerProfileInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutLearnerProfileInput, UserUncheckedUpdateWithoutLearnerProfileInput>
  }

  export type UserUpdateWithoutLearnerProfileInput = {
    id?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    passwordHash?: StringFieldUpdateOperationsInput | string
    accountStatus?: EnumAccountStatusFieldUpdateOperationsInput | $Enums.AccountStatus
    profileImageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    phoneVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    roles?: UserRoleAssignmentUpdateManyWithoutUserNestedInput
    authTokens?: AuthTokenUpdateManyWithoutUserNestedInput
    supplierProfile?: SupplierProfileUpdateOneWithoutUserNestedInput
    invitedRoles?: RoleInvitationUpdateManyWithoutInvitedByUserNestedInput
    usedInvitations?: RoleInvitationUpdateManyWithoutUsedByUserNestedInput
    assignedRoles?: UserRoleAssignmentUpdateManyWithoutAssignedByUserNestedInput
  }

  export type UserUncheckedUpdateWithoutLearnerProfileInput = {
    id?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    passwordHash?: StringFieldUpdateOperationsInput | string
    accountStatus?: EnumAccountStatusFieldUpdateOperationsInput | $Enums.AccountStatus
    profileImageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    phoneVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    roles?: UserRoleAssignmentUncheckedUpdateManyWithoutUserNestedInput
    authTokens?: AuthTokenUncheckedUpdateManyWithoutUserNestedInput
    supplierProfile?: SupplierProfileUncheckedUpdateOneWithoutUserNestedInput
    invitedRoles?: RoleInvitationUncheckedUpdateManyWithoutInvitedByUserNestedInput
    usedInvitations?: RoleInvitationUncheckedUpdateManyWithoutUsedByUserNestedInput
    assignedRoles?: UserRoleAssignmentUncheckedUpdateManyWithoutAssignedByUserNestedInput
  }

  export type UserCreateWithoutSupplierProfileInput = {
    id?: string
    displayName: string
    email: string
    phone?: string | null
    passwordHash: string
    accountStatus?: $Enums.AccountStatus
    profileImageUrl?: string | null
    emailVerifiedAt?: Date | string | null
    phoneVerifiedAt?: Date | string | null
    lastLoginAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    roles?: UserRoleAssignmentCreateNestedManyWithoutUserInput
    authTokens?: AuthTokenCreateNestedManyWithoutUserInput
    learnerProfile?: LearnerProfileCreateNestedOneWithoutUserInput
    invitedRoles?: RoleInvitationCreateNestedManyWithoutInvitedByUserInput
    usedInvitations?: RoleInvitationCreateNestedManyWithoutUsedByUserInput
    assignedRoles?: UserRoleAssignmentCreateNestedManyWithoutAssignedByUserInput
  }

  export type UserUncheckedCreateWithoutSupplierProfileInput = {
    id?: string
    displayName: string
    email: string
    phone?: string | null
    passwordHash: string
    accountStatus?: $Enums.AccountStatus
    profileImageUrl?: string | null
    emailVerifiedAt?: Date | string | null
    phoneVerifiedAt?: Date | string | null
    lastLoginAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    roles?: UserRoleAssignmentUncheckedCreateNestedManyWithoutUserInput
    authTokens?: AuthTokenUncheckedCreateNestedManyWithoutUserInput
    learnerProfile?: LearnerProfileUncheckedCreateNestedOneWithoutUserInput
    invitedRoles?: RoleInvitationUncheckedCreateNestedManyWithoutInvitedByUserInput
    usedInvitations?: RoleInvitationUncheckedCreateNestedManyWithoutUsedByUserInput
    assignedRoles?: UserRoleAssignmentUncheckedCreateNestedManyWithoutAssignedByUserInput
  }

  export type UserCreateOrConnectWithoutSupplierProfileInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutSupplierProfileInput, UserUncheckedCreateWithoutSupplierProfileInput>
  }

  export type LocationCreateWithoutSupplierPickupForInput = {
    id?: string
    country: string
    city: string
    area?: string | null
    addressLine?: string | null
    latitude?: Decimal | DecimalJsLike | number | string | null
    longitude?: Decimal | DecimalJsLike | number | string | null
    locationType?: string | null
    visibility?: string | null
    isApproximate?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type LocationUncheckedCreateWithoutSupplierPickupForInput = {
    id?: string
    country: string
    city: string
    area?: string | null
    addressLine?: string | null
    latitude?: Decimal | DecimalJsLike | number | string | null
    longitude?: Decimal | DecimalJsLike | number | string | null
    locationType?: string | null
    visibility?: string | null
    isApproximate?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type LocationCreateOrConnectWithoutSupplierPickupForInput = {
    where: LocationWhereUniqueInput
    create: XOR<LocationCreateWithoutSupplierPickupForInput, LocationUncheckedCreateWithoutSupplierPickupForInput>
  }

  export type UserUpsertWithoutSupplierProfileInput = {
    update: XOR<UserUpdateWithoutSupplierProfileInput, UserUncheckedUpdateWithoutSupplierProfileInput>
    create: XOR<UserCreateWithoutSupplierProfileInput, UserUncheckedCreateWithoutSupplierProfileInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutSupplierProfileInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutSupplierProfileInput, UserUncheckedUpdateWithoutSupplierProfileInput>
  }

  export type UserUpdateWithoutSupplierProfileInput = {
    id?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    passwordHash?: StringFieldUpdateOperationsInput | string
    accountStatus?: EnumAccountStatusFieldUpdateOperationsInput | $Enums.AccountStatus
    profileImageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    phoneVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    roles?: UserRoleAssignmentUpdateManyWithoutUserNestedInput
    authTokens?: AuthTokenUpdateManyWithoutUserNestedInput
    learnerProfile?: LearnerProfileUpdateOneWithoutUserNestedInput
    invitedRoles?: RoleInvitationUpdateManyWithoutInvitedByUserNestedInput
    usedInvitations?: RoleInvitationUpdateManyWithoutUsedByUserNestedInput
    assignedRoles?: UserRoleAssignmentUpdateManyWithoutAssignedByUserNestedInput
  }

  export type UserUncheckedUpdateWithoutSupplierProfileInput = {
    id?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    passwordHash?: StringFieldUpdateOperationsInput | string
    accountStatus?: EnumAccountStatusFieldUpdateOperationsInput | $Enums.AccountStatus
    profileImageUrl?: NullableStringFieldUpdateOperationsInput | string | null
    emailVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    phoneVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastLoginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    roles?: UserRoleAssignmentUncheckedUpdateManyWithoutUserNestedInput
    authTokens?: AuthTokenUncheckedUpdateManyWithoutUserNestedInput
    learnerProfile?: LearnerProfileUncheckedUpdateOneWithoutUserNestedInput
    invitedRoles?: RoleInvitationUncheckedUpdateManyWithoutInvitedByUserNestedInput
    usedInvitations?: RoleInvitationUncheckedUpdateManyWithoutUsedByUserNestedInput
    assignedRoles?: UserRoleAssignmentUncheckedUpdateManyWithoutAssignedByUserNestedInput
  }

  export type LocationUpsertWithoutSupplierPickupForInput = {
    update: XOR<LocationUpdateWithoutSupplierPickupForInput, LocationUncheckedUpdateWithoutSupplierPickupForInput>
    create: XOR<LocationCreateWithoutSupplierPickupForInput, LocationUncheckedCreateWithoutSupplierPickupForInput>
    where?: LocationWhereInput
  }

  export type LocationUpdateToOneWithWhereWithoutSupplierPickupForInput = {
    where?: LocationWhereInput
    data: XOR<LocationUpdateWithoutSupplierPickupForInput, LocationUncheckedUpdateWithoutSupplierPickupForInput>
  }

  export type LocationUpdateWithoutSupplierPickupForInput = {
    id?: StringFieldUpdateOperationsInput | string
    country?: StringFieldUpdateOperationsInput | string
    city?: StringFieldUpdateOperationsInput | string
    area?: NullableStringFieldUpdateOperationsInput | string | null
    addressLine?: NullableStringFieldUpdateOperationsInput | string | null
    latitude?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    longitude?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    locationType?: NullableStringFieldUpdateOperationsInput | string | null
    visibility?: NullableStringFieldUpdateOperationsInput | string | null
    isApproximate?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type LocationUncheckedUpdateWithoutSupplierPickupForInput = {
    id?: StringFieldUpdateOperationsInput | string
    country?: StringFieldUpdateOperationsInput | string
    city?: StringFieldUpdateOperationsInput | string
    area?: NullableStringFieldUpdateOperationsInput | string | null
    addressLine?: NullableStringFieldUpdateOperationsInput | string | null
    latitude?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    longitude?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    locationType?: NullableStringFieldUpdateOperationsInput | string | null
    visibility?: NullableStringFieldUpdateOperationsInput | string | null
    isApproximate?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SupplierProfileCreateWithoutDefaultPickupLocationInput = {
    id?: string
    supplierType?: string | null
    publicName?: string | null
    description?: string | null
    verificationStatus?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    user: UserCreateNestedOneWithoutSupplierProfileInput
  }

  export type SupplierProfileUncheckedCreateWithoutDefaultPickupLocationInput = {
    id?: string
    userId: string
    supplierType?: string | null
    publicName?: string | null
    description?: string | null
    verificationStatus?: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type SupplierProfileCreateOrConnectWithoutDefaultPickupLocationInput = {
    where: SupplierProfileWhereUniqueInput
    create: XOR<SupplierProfileCreateWithoutDefaultPickupLocationInput, SupplierProfileUncheckedCreateWithoutDefaultPickupLocationInput>
  }

  export type SupplierProfileCreateManyDefaultPickupLocationInputEnvelope = {
    data: SupplierProfileCreateManyDefaultPickupLocationInput | SupplierProfileCreateManyDefaultPickupLocationInput[]
    skipDuplicates?: boolean
  }

  export type SupplierProfileUpsertWithWhereUniqueWithoutDefaultPickupLocationInput = {
    where: SupplierProfileWhereUniqueInput
    update: XOR<SupplierProfileUpdateWithoutDefaultPickupLocationInput, SupplierProfileUncheckedUpdateWithoutDefaultPickupLocationInput>
    create: XOR<SupplierProfileCreateWithoutDefaultPickupLocationInput, SupplierProfileUncheckedCreateWithoutDefaultPickupLocationInput>
  }

  export type SupplierProfileUpdateWithWhereUniqueWithoutDefaultPickupLocationInput = {
    where: SupplierProfileWhereUniqueInput
    data: XOR<SupplierProfileUpdateWithoutDefaultPickupLocationInput, SupplierProfileUncheckedUpdateWithoutDefaultPickupLocationInput>
  }

  export type SupplierProfileUpdateManyWithWhereWithoutDefaultPickupLocationInput = {
    where: SupplierProfileScalarWhereInput
    data: XOR<SupplierProfileUpdateManyMutationInput, SupplierProfileUncheckedUpdateManyWithoutDefaultPickupLocationInput>
  }

  export type SupplierProfileScalarWhereInput = {
    AND?: SupplierProfileScalarWhereInput | SupplierProfileScalarWhereInput[]
    OR?: SupplierProfileScalarWhereInput[]
    NOT?: SupplierProfileScalarWhereInput | SupplierProfileScalarWhereInput[]
    id?: StringFilter<"SupplierProfile"> | string
    userId?: StringFilter<"SupplierProfile"> | string
    supplierType?: StringNullableFilter<"SupplierProfile"> | string | null
    publicName?: StringNullableFilter<"SupplierProfile"> | string | null
    description?: StringNullableFilter<"SupplierProfile"> | string | null
    verificationStatus?: StringFilter<"SupplierProfile"> | string
    defaultPickupLocationId?: StringNullableFilter<"SupplierProfile"> | string | null
    createdAt?: DateTimeFilter<"SupplierProfile"> | Date | string
    updatedAt?: DateTimeFilter<"SupplierProfile"> | Date | string
  }

  export type UserRoleAssignmentCreateManyUserInput = {
    id?: string
    role: $Enums.UserRole
    isPrimary?: boolean
    assignedBy?: string | null
    createdAt?: Date | string
  }

  export type AuthTokenCreateManyUserInput = {
    id?: string
    tokenHash: string
    tokenType: $Enums.AuthTokenType
    target: string
    expiresAt: Date | string
    usedAt?: Date | string | null
    createdAt?: Date | string
  }

  export type RoleInvitationCreateManyInvitedByUserInput = {
    id?: string
    targetEmail?: string | null
    targetPhone?: string | null
    targetRole: $Enums.RoleInvitationTargetRole
    tokenHash: string
    status?: $Enums.RoleInvitationStatus
    expiresAt: Date | string
    usedAt?: Date | string | null
    usedByUserId?: string | null
    notes?: string | null
    createdAt?: Date | string
  }

  export type RoleInvitationCreateManyUsedByUserInput = {
    id?: string
    targetEmail?: string | null
    targetPhone?: string | null
    targetRole: $Enums.RoleInvitationTargetRole
    tokenHash: string
    invitedBy?: string | null
    status?: $Enums.RoleInvitationStatus
    expiresAt: Date | string
    usedAt?: Date | string | null
    notes?: string | null
    createdAt?: Date | string
  }

  export type UserRoleAssignmentCreateManyAssignedByUserInput = {
    id?: string
    userId: string
    role: $Enums.UserRole
    isPrimary?: boolean
    createdAt?: Date | string
  }

  export type UserRoleAssignmentUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    role?: EnumUserRoleFieldUpdateOperationsInput | $Enums.UserRole
    isPrimary?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    assignedByUser?: UserUpdateOneWithoutAssignedRolesNestedInput
  }

  export type UserRoleAssignmentUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    role?: EnumUserRoleFieldUpdateOperationsInput | $Enums.UserRole
    isPrimary?: BoolFieldUpdateOperationsInput | boolean
    assignedBy?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserRoleAssignmentUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    role?: EnumUserRoleFieldUpdateOperationsInput | $Enums.UserRole
    isPrimary?: BoolFieldUpdateOperationsInput | boolean
    assignedBy?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AuthTokenUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    tokenHash?: StringFieldUpdateOperationsInput | string
    tokenType?: EnumAuthTokenTypeFieldUpdateOperationsInput | $Enums.AuthTokenType
    target?: StringFieldUpdateOperationsInput | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AuthTokenUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    tokenHash?: StringFieldUpdateOperationsInput | string
    tokenType?: EnumAuthTokenTypeFieldUpdateOperationsInput | $Enums.AuthTokenType
    target?: StringFieldUpdateOperationsInput | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AuthTokenUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    tokenHash?: StringFieldUpdateOperationsInput | string
    tokenType?: EnumAuthTokenTypeFieldUpdateOperationsInput | $Enums.AuthTokenType
    target?: StringFieldUpdateOperationsInput | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RoleInvitationUpdateWithoutInvitedByUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    targetEmail?: NullableStringFieldUpdateOperationsInput | string | null
    targetPhone?: NullableStringFieldUpdateOperationsInput | string | null
    targetRole?: EnumRoleInvitationTargetRoleFieldUpdateOperationsInput | $Enums.RoleInvitationTargetRole
    tokenHash?: StringFieldUpdateOperationsInput | string
    status?: EnumRoleInvitationStatusFieldUpdateOperationsInput | $Enums.RoleInvitationStatus
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    usedByUser?: UserUpdateOneWithoutUsedInvitationsNestedInput
  }

  export type RoleInvitationUncheckedUpdateWithoutInvitedByUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    targetEmail?: NullableStringFieldUpdateOperationsInput | string | null
    targetPhone?: NullableStringFieldUpdateOperationsInput | string | null
    targetRole?: EnumRoleInvitationTargetRoleFieldUpdateOperationsInput | $Enums.RoleInvitationTargetRole
    tokenHash?: StringFieldUpdateOperationsInput | string
    status?: EnumRoleInvitationStatusFieldUpdateOperationsInput | $Enums.RoleInvitationStatus
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    usedByUserId?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RoleInvitationUncheckedUpdateManyWithoutInvitedByUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    targetEmail?: NullableStringFieldUpdateOperationsInput | string | null
    targetPhone?: NullableStringFieldUpdateOperationsInput | string | null
    targetRole?: EnumRoleInvitationTargetRoleFieldUpdateOperationsInput | $Enums.RoleInvitationTargetRole
    tokenHash?: StringFieldUpdateOperationsInput | string
    status?: EnumRoleInvitationStatusFieldUpdateOperationsInput | $Enums.RoleInvitationStatus
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    usedByUserId?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RoleInvitationUpdateWithoutUsedByUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    targetEmail?: NullableStringFieldUpdateOperationsInput | string | null
    targetPhone?: NullableStringFieldUpdateOperationsInput | string | null
    targetRole?: EnumRoleInvitationTargetRoleFieldUpdateOperationsInput | $Enums.RoleInvitationTargetRole
    tokenHash?: StringFieldUpdateOperationsInput | string
    status?: EnumRoleInvitationStatusFieldUpdateOperationsInput | $Enums.RoleInvitationStatus
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    invitedByUser?: UserUpdateOneWithoutInvitedRolesNestedInput
  }

  export type RoleInvitationUncheckedUpdateWithoutUsedByUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    targetEmail?: NullableStringFieldUpdateOperationsInput | string | null
    targetPhone?: NullableStringFieldUpdateOperationsInput | string | null
    targetRole?: EnumRoleInvitationTargetRoleFieldUpdateOperationsInput | $Enums.RoleInvitationTargetRole
    tokenHash?: StringFieldUpdateOperationsInput | string
    invitedBy?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumRoleInvitationStatusFieldUpdateOperationsInput | $Enums.RoleInvitationStatus
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RoleInvitationUncheckedUpdateManyWithoutUsedByUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    targetEmail?: NullableStringFieldUpdateOperationsInput | string | null
    targetPhone?: NullableStringFieldUpdateOperationsInput | string | null
    targetRole?: EnumRoleInvitationTargetRoleFieldUpdateOperationsInput | $Enums.RoleInvitationTargetRole
    tokenHash?: StringFieldUpdateOperationsInput | string
    invitedBy?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumRoleInvitationStatusFieldUpdateOperationsInput | $Enums.RoleInvitationStatus
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserRoleAssignmentUpdateWithoutAssignedByUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    role?: EnumUserRoleFieldUpdateOperationsInput | $Enums.UserRole
    isPrimary?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutRolesNestedInput
  }

  export type UserRoleAssignmentUncheckedUpdateWithoutAssignedByUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    role?: EnumUserRoleFieldUpdateOperationsInput | $Enums.UserRole
    isPrimary?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserRoleAssignmentUncheckedUpdateManyWithoutAssignedByUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    role?: EnumUserRoleFieldUpdateOperationsInput | $Enums.UserRole
    isPrimary?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SupplierProfileCreateManyDefaultPickupLocationInput = {
    id?: string
    userId: string
    supplierType?: string | null
    publicName?: string | null
    description?: string | null
    verificationStatus?: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type SupplierProfileUpdateWithoutDefaultPickupLocationInput = {
    id?: StringFieldUpdateOperationsInput | string
    supplierType?: NullableStringFieldUpdateOperationsInput | string | null
    publicName?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    verificationStatus?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutSupplierProfileNestedInput
  }

  export type SupplierProfileUncheckedUpdateWithoutDefaultPickupLocationInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    supplierType?: NullableStringFieldUpdateOperationsInput | string | null
    publicName?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    verificationStatus?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SupplierProfileUncheckedUpdateManyWithoutDefaultPickupLocationInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    supplierType?: NullableStringFieldUpdateOperationsInput | string | null
    publicName?: NullableStringFieldUpdateOperationsInput | string | null
    description?: NullableStringFieldUpdateOperationsInput | string | null
    verificationStatus?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}