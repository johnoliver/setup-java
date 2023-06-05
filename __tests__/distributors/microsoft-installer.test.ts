import {MicrosoftDistributions} from '../../src/distributions/microsoft/installer';
import os from 'os';
import {HttpClient} from '@actions/http-client';

import manifestData from '../data/microsoft.json';
import {AdoptiumMarketplaceDistributionBase} from "../../src/distributions/adoptium-marketplace/installer";
import {IAdoptiumMarketplaceAvailableVersions} from "../../src/distributions/adoptium-marketplace/models";

describe('findPackageForDownload', () => {
  let distribution: MicrosoftDistributions;
  let spyHttpClient: jest.SpyInstance;

  beforeEach(() => {
    spyHttpClient = jest.spyOn(HttpClient.prototype, 'getJson');
    spyHttpClient.mockReturnValue({
      statusCode: 200,
      headers: {},
      result: []
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it.each([
    [
      '17',
      '17.0.5',
      '17.0.5+8',
      'https://aka.ms/download-jdk/microsoft-jdk-17.0.5-{{OS_TYPE}}-x64.{{ARCHIVE_TYPE}}'
    ],
    [
      '17',
      '17.x',
      '17.0.7+7',
      'https://aka.ms/download-jdk/microsoft-jdk-17.0.7-{{OS_TYPE}}-x64.{{ARCHIVE_TYPE}}'
    ],
    [
      '16',
      '16.0.x',
      '16.0.2+7',
      'https://aka.ms/download-jdk/microsoft-jdk-16.0.2.7.1-{{OS_TYPE}}-x64.{{ARCHIVE_TYPE}}'
    ],
    [
      '11',
      '11.0.17',
      '11.0.17+8',
      'https://aka.ms/download-jdk/microsoft-jdk-11.0.17-{{OS_TYPE}}-x64.{{ARCHIVE_TYPE}}'
    ],
    [
      '11',
      '11.0.19',
      '11.0.19+7',
      'https://aka.ms/download-jdk/microsoft-jdk-11.0.19-{{OS_TYPE}}-x64.{{ARCHIVE_TYPE}}'
    ]
  ])('version is %s -> %s', async (majorVersion, input, expectedVersion, expectedUrl) => {
    distribution = new MicrosoftDistributions({
        version: majorVersion,
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      }
    )

    spyHttpClient.mockReturnValueOnce({
      statusCode: 200,
      headers: {},
      result: manifestData
    });

    const result = await distribution['findPackageForDownload'](input);
    expect(result.version).toBe(expectedVersion);
    let os: string;
    let archive: string;
    switch (process.platform) {
      case 'darwin':
        os = 'macos';
        archive = 'tar.gz';
        break;
      case 'win32':
        os = 'windows';
        archive = 'zip';
        break;
      default:
        os = process.platform.toString();
        archive = 'tar.gz';
        break;
    }
    const url = expectedUrl
      .replace('{{OS_TYPE}}', os)
      .replace('{{ARCHIVE_TYPE}}', archive);
    expect(result.url).toBe(url);
  });

  it.each([
    ['amd64', 'x64'],
    ['arm64', 'aarch64']
  ])(
    'defaults to os.arch(): %s mapped to distro arch: %s',
    async (osArch: string, distroArch: string) => {
      jest.spyOn(os, 'arch').mockReturnValue(osArch);
      jest.spyOn(os, 'platform').mockReturnValue('linux');

      spyHttpClient.mockReturnValueOnce({
        statusCode: 200,
        headers: {},
        result: AdoptiumMarketplaceDistributionBase.filterRelease(manifestData as IAdoptiumMarketplaceAvailableVersions[], "linux", distroArch, "jdk", "hotspot")
      });

      const version = '17';
      const distro = new MicrosoftDistributions({
        version,
        architecture: '', // to get default value
        packageType: 'jdk',
        checkLatest: false
      });

      const result = await distro['findPackageForDownload'](version);
      const expectedUrl = `https://aka.ms/download-jdk/microsoft-jdk-17.0.7-linux-${distroArch}.tar.gz`;

      expect(result.url).toBe(expectedUrl);
    }
  );

  it('should throw an error', async () => {
    await expect(distribution['findPackageForDownload']('8')).rejects.toThrow(
      /Could not find satisfied version for SemVer */
    );
  });
});
