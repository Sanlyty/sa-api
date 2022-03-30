type GroupByResult<T> = Record<any, T[]>;

export class ArrayUtils {
    /** Group elements of array by the value of field given by `key` */
    public static groupBy<T>(array: T[], key: keyof T): GroupByResult<T> {
        return array.reduce((result, currentValue) => {
            (result[currentValue[key] as any] =
                (result[currentValue[key]] as T[]) || ([] as T[])).push(
                currentValue
            );
            return result;
        }, {} as GroupByResult<T>);
    }
}
