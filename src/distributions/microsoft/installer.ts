import {JavaInstallerOptions,} from '../base-models';
import java16Releases from './microsoft-jdk16.json';
import {
  AdoptiumMarketplaceImplementation,
  AdoptiumMarketplaceVendor,
  IAdoptiumMarketplaceAvailableVersions
} from "../adoptium-marketplace/models";
import {AdoptiumMarketplaceDistributionBase} from "../adoptium-marketplace/installer";

export class MicrosoftDistributions extends AdoptiumMarketplaceDistributionBase {
  constructor(installerOptions: JavaInstallerOptions) {
    super(AdoptiumMarketplaceVendor.microsoft, installerOptions, AdoptiumMarketplaceImplementation.Hotspot, 'Microsoft');
  }

  /**
   * Before switching to Adoptium marketplace, used to contain 16 versions that are not in the marketplace, to maintain
   * backwards compatibility add them in
   */
  protected getAdditionalReleases(): IAdoptiumMarketplaceAvailableVersions[] {
    return java16Releases as IAdoptiumMarketplaceAvailableVersions[]
  }
}
