type GroupByResult<T> = Record<string | number | symbol, T[]>;

export class ArrayUtils {
    /** Group elements of array by the value of field given by `key` */
    public static groupBy<T extends Record<keyof T, string | number | symbol>>(
        array: T[],
        key: keyof T
    ): GroupByResult<T> {
        return array.reduce((result, currentValue) => {
            (result[currentValue[key]] = result[currentValue[key]] || []).push(
                currentValue
            );
            return result;
        }, {} as GroupByResult<T>);
    }
}
