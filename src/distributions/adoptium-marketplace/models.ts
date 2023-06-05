// Models from https://marketplace-api.adoptium.net/q/swagger-ui/


export enum AdoptiumMarketplaceImplementation {
  Hotspot = 'Hotspot',
  OpenJ9 = 'OpenJ9'
}

export enum AdoptiumMarketplaceVendor {
  adoptium = 'adoptium',
  redhat = 'redhat',
  alibaba = 'alibaba',
  ibm = 'ibm',
  microsoft = 'microsoft',
  azul = 'azul',
  huawei = 'huawei'
}

export interface IPackage {
  installer_type?: string | null;
  sha256sum: string;
  sha256sum_link: string;
  signature_link?: string | null;
  link: string;
  name: string;
}

export interface IBinary {
  aqavit_results_link?: string | null;
  architecture: string;
  c_lib?: string | null;
  distribution?: string | null;
  installer?: IPackage | null;
  openjdk_scm_ref?: string | null;
  tck_affidavit_link?: string | null;
  timestamp?: string | null;
  image_type: string;
  jvm_impl: string;
  os: string;
  package: IPackage;
  scm_ref?: string | null;
}

export interface ISource {
  link?: string | null;
  name?: string | null;
}

export interface IVersion {
  build: number;
  major: number;
  minor: number;
  openjdk_version: string;
  security?: number | null;
  patch?: string | null;
  pre?: string | null;
  optional?: string | null;
}

export interface IAdoptiumMarketplaceAvailableVersions {
  binaries: IBinary[];
  release_link?: string | null;
  release_name: string;
  vendor: string;
  openjdk_version_data: IVersion;
  last_updated_timestamp?: string | null;
  source?: ISource | null;
  vendor_public_key_link?: string | null;
}
