import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';

import fs from 'fs';
import path from 'path';
import semver from 'semver';

import {JavaBase} from '../base-installer';
import {
  AdoptiumMarketplaceImplementation,
  AdoptiumMarketplaceVendor,
  IAdoptiumMarketplaceAvailableVersions
} from './models';
import {JavaDownloadRelease, JavaInstallerOptions, JavaInstallerResults} from '../base-models';
import {extractJdkFile, getDownloadArchiveExtension, isVersionSatisfies} from '../../util';

/*
 * Super class for distributions delivered via the Adoptium Marketplace
 */
export abstract class AdoptiumMarketplaceDistributionBase extends JavaBase {
  protected constructor(
    private readonly vendor: AdoptiumMarketplaceVendor,
    installerOptions: JavaInstallerOptions,
    private readonly jvmImpl: AdoptiumMarketplaceImplementation,
    private readonly distributionName = `${vendor.valueOf()}-${jvmImpl}`,
  ) {
    super(distributionName, installerOptions);
  }

  // Additional releases, currently used to add missing releases when switching over to
  protected abstract getAdditionalReleases(): IAdoptiumMarketplaceAvailableVersions[];

  async findPackageForDownload(
    version: string
  ): Promise<JavaDownloadRelease> {
    const availableVersionsRaw = await this.getAvailableVersions();
    const availableVersionsWithBinaries = availableVersionsRaw
      .filter(item => item.binaries.length > 0)
      .map(item => {
        // normalize 17.0.0-beta+33.0.202107301459 to 17.0.0+33.0.202107301459 for earlier access versions
        const formattedVersion = item.openjdk_version_data.openjdk_version
        return {
          version: formattedVersion,
          url: item.binaries[0].package.link
        } as JavaDownloadRelease;
      });

    const satisfiedVersions = availableVersionsWithBinaries
      .filter(item => isVersionSatisfies(version, item.version))
      .sort((a, b) => {
        return -semver.compareBuild(a.version, b.version);
      });

    const resolvedFullVersion =
      satisfiedVersions.length > 0 ? satisfiedVersions[0] : null;
    if (!resolvedFullVersion) {
      const availableOptions = availableVersionsWithBinaries
        .map(item => item.version)
        .join(', ');
      const availableOptionsMessage = availableOptions
        ? `\nAvailable versions: ${availableOptions}`
        : '';
      throw new Error(
        `Could not find satisfied version for SemVer '${version}'. ${availableOptionsMessage}`
      );
    }

    return resolvedFullVersion;
  }

  protected async downloadTool(
    javaRelease: JavaDownloadRelease
  ): Promise<JavaInstallerResults> {
    core.info(
      `Downloading Java ${javaRelease.version} (${this.distribution}) from ${javaRelease.url} ...`
    );
    const javaArchivePath = await tc.downloadTool(javaRelease.url);

    core.info(`Extracting Java archive...`);
    const extension = getDownloadArchiveExtension();

    const extractedJavaPath = await extractJdkFile(javaArchivePath, extension);

    const archiveName = fs.readdirSync(extractedJavaPath)[0];
    const archivePath = path.join(extractedJavaPath, archiveName);
    const version = this.getToolcacheVersionName(javaRelease.version);

    const javaPath = await tc.cacheDir(
      archivePath,
      this.toolcacheFolderName,
      version,
      this.architecture
    );

    return {version: javaRelease.version, path: javaPath};
  }

  protected get toolcacheFolderName(): string {
    return super.toolcacheFolderName;
  }

  private async getAvailableVersions(): Promise<IAdoptiumMarketplaceAvailableVersions[]> {
    const platform = this.getPlatformOption();
    const arch = this.distributionArchitecture();
    const imageType = this.packageType;
    const versionRange = encodeURI('[1.0,100.0]'); // retrieve all available versions

    if (core.isDebug()) {
      console.time(`Retrieving available versions for ${this.vendor} took`); // eslint-disable-line no-console
    }

    const baseRequestArguments = [
      `project=jdk`,
      'sort_method=DEFAULT',
      'sort_order=DESC',
      `os=${platform}`,
      `architecture=${arch}`,
      `image_type=${imageType}`,
      `jvm_impl=${this.jvmImpl.toLowerCase()}`
    ].join('&');

    // need to iterate through all pages to retrieve the list of all versions
    // Adoptium API doesn't provide way to retrieve the count of pages to iterate so infinity loop
    let page_index = 0;
    const availableVersions: IAdoptiumMarketplaceAvailableVersions[] = [];
    while (true) {
      const requestArguments = `${baseRequestArguments}&page_size=20&page=${page_index}`;
      const availableVersionsUrl = `https://marketplace-api.adoptium.net/v1/assets/version/${this.vendor}/${versionRange}?${requestArguments}`;
      if (core.isDebug() && page_index === 0) {
        // url is identical except page_index so print it once for debug
        core.debug(
          `Gathering available versions from '${availableVersionsUrl}'`
        );
      }

      const paginationPage = (
        await this.http.getJson<IAdoptiumMarketplaceAvailableVersions[]>(
          availableVersionsUrl
        )
      ).result;
      if (paginationPage === null || paginationPage.length === 0) {
        // break infinity loop because we have reached end of pagination
        break;
      }

      availableVersions.push(...paginationPage);
      page_index++;
    }

    if (core.isDebug()) {
      core.startGroup('Print information about available versions');
      console.timeEnd(`Retrieving available versions for ${this.vendor} took`); // eslint-disable-line no-console
      core.debug(`Available versions: [${availableVersions.length}]`);
      core.debug(
        availableVersions.map(item => item.openjdk_version_data.openjdk_version).join(', ')
      );
      core.endGroup();
    }

    availableVersions.push(...this.getAdditionalReleasesFiltered(platform, arch, imageType))

    return availableVersions;
  }

  private getAdditionalReleasesFiltered(platform: string, arch: string, imageType: string): IAdoptiumMarketplaceAvailableVersions[] {
    return AdoptiumMarketplaceDistributionBase.filterRelease(this.getAdditionalReleases(), platform, arch, imageType, this.jvmImpl)
  }

  public static filterRelease(releases: IAdoptiumMarketplaceAvailableVersions[], platform: string, arch: string, imageType: string, jvmImpl: string) {
    return releases.map(it => {
      return {
        openjdk_version_data: it.openjdk_version_data,
        binaries: it.binaries
          .filter(binary => {
            return binary.os.toLowerCase() == platform.toLowerCase() &&
              binary.architecture.toLowerCase() == arch.toLowerCase() &&
              binary.image_type.toLowerCase() == imageType.toLowerCase() &&
              binary.jvm_impl.toLowerCase() == jvmImpl.toLowerCase()
          }),
        vendor: it.vendor,
        release_link: it.release_link,
        release_name: it.release_name
      } as IAdoptiumMarketplaceAvailableVersions
    })
      .filter(release => {
        return release.binaries.length > 0
      });
  }

  private getPlatformOption(): string {
    // Adoptium has own platform names so need to map them
    switch (process.platform) {
      case 'darwin':
        return 'mac';
      case 'win32':
        return 'windows';
      default:
        return process.platform;
    }
  }
}
