import { For, JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import clsx from 'clsx';
import styles from '@/components/genericTable.module.scss';

export type GenericTableCell = {
  content?: JSX.Element;
  header?: boolean;
  colspan?: number;
  rowspan?: number;
  alignCenter?: boolean;
  alignRight?: boolean;
  valignMiddle?: boolean;
  valignBottom?: boolean;
};

export type GenericTableRow = {
  cells: GenericTableCell[];
};

export default function GenericTable(props: {
  rows: GenericTableRow[];
  bordered?: boolean;
  striped?: boolean;
  class?: string;
}) {
  return (
    <div class={clsx(styles.wrapper, 'no-scrollbar')}>
      <table
        class={clsx(
          styles.genericTable,
          props.bordered && styles.bordered,
          props.class
        )}
      >
        <Show when={props.bordered}>
          <div class={styles.border} />
        </Show>
        <tbody>
          <For each={props.rows}>{(row, idx) => (
            <tr
              class={clsx(
                styles.genericRow,
                props.striped && !(idx() % 2) && styles.striped
              )}
            >
              <For each={row.cells}>{(cell) => (
                <Dynamic
                  component={cell.header ? 'th' : 'td'}
                  colSpan={cell.colspan}
                  rowSpan={cell.rowspan}
                  class={clsx(
                    cell.header ? styles.genericHeaderCell : styles.genericCell,
                    cell.alignCenter && styles.cellAlignCenter,
                    cell.alignRight && styles.cellAlignRight,
                    cell.valignMiddle && styles.cellValignMiddle,
                    cell.valignBottom && styles.cellValignBottom
                  )}
                >
                  {cell.content}
                </Dynamic>
              )}</For>
            </tr>
          )}</For>
        </tbody>
      </table>
    </div>
  );
}
