import type { DownloadMediaOptions, DownloadOptions } from '@/lib/appManagers/apiFileManager';
import getDocumentDownloadOptions from '@/lib/appManagers/utils/docs/getDocumentDownloadOptions';
import getPhotoDownloadOptions from '@/lib/appManagers/utils/photos/getPhotoDownloadOptions';
import getWebDocumentDownloadOptions from '@/lib/appManagers/utils/webDocs/getWebDocumentDownloadOptions';
import isWebDocument from '@/lib/appManagers/utils/webDocs/isWebDocument';
import getWebFileDownloadOptions from '@/lib/appManagers/utils/webFiles/getWebFileDownloadOptions';
import isWebFileLocation from '@/lib/appManagers/utils/webFiles/isWebFileLocation';
import getDownloadFileNameFromOptions from '@/lib/appManagers/utils/download/getDownloadFileNameFromOptions';

export default function getDownloadMediaDetails(options: DownloadMediaOptions) {
  const { media, thumb, queueId, onlyCache } = options;

  let downloadOptions: DownloadOptions;
  if (media._ === 'document') downloadOptions = getDocumentDownloadOptions(media, { thumb: thumb as any, queueId, onlyCache });
  else if (media._ === 'photo') downloadOptions = getPhotoDownloadOptions(media, thumb as any, queueId, onlyCache);
  else if (isWebDocument(media)) downloadOptions = getWebDocumentDownloadOptions(media);
  else if (isWebFileLocation(media)) {
    downloadOptions = getWebFileDownloadOptions(media);
    if (options.fileName) downloadOptions.fileName = options.fileName;
  }

  downloadOptions!.downloadId = options.downloadId;

  const fileName = getDownloadFileNameFromOptions(downloadOptions!);
  return { fileName, downloadOptions: downloadOptions! };
}
