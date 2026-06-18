import clsx from 'clsx';
import styles from './featureDetailsIconSticker.module.scss';
import Icon from './icon';

export default function createFeatureDetailsIconSticker(icon: Icon, className?: string) {
  const div = document.createElement('div');
  div.className = clsx(styles.Container, className);
  div.appendChild(Icon(icon, styles.Icon));
  return div;
}
