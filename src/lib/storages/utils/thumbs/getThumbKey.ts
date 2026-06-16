import type { MyPhoto } from '@/lib/appManagers/appPhotosManager';
import type { ThumbStorageMedia } from '@/lib/storages/thumbs';
import type { WebDocument } from '@/layer';
import { getFileNameByLocation } from '@/helpers/fileName';
import isWebFileLocation from '@/lib/appManagers/utils/webFiles/isWebFileLocation';

export default function getThumbKey(media: ThumbStorageMedia) {
  if (isWebFileLocation(media)) {
    return getFileNameByLocation(media);
  }

  return media._ + ((media as MyPhoto).id ?? (media as WebDocument).url);
}
