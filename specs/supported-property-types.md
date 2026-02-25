
| Property base type                             | Valid as title key? | Valid as primary key? | Notes                                                        |
| :--------------------------------------------- | :------------------ | :-------------------- | :----------------------------------------------------------- |
| Commonly used: `String`, `Integer`, `Short`    | Yes                 | Yes                   |                                                              |
| Time-based: `Date`, `Timestamp`                | Yes                 | Discouraged           | Typically, time values are inappropriate as primary keys, due to potentially unexpected collisions / uniqueness based on the storage format differing from the display format. In most cases, we recommend using `String` instead. |
| Number-like: `Boolean`, `Byte`, `Long`         | Yes                 | Discouraged           | `Boolean` limits your object type to two object instances. `Byte` properties can only be assigned in Actions via an `Integer` parameter, so in most cases we recommend using `Integer` properties instead. `Long` has representational issues in Javascript, so not all frontend libraries and code work well with `Long` values greater than 1e15. In most cases, we recommend using `String` instead. |
| Float-like: `Float`, `Double`, `Decimal`       | Yes                 | No                    |                                                              |
| `Vector`                                       | No                  | No                    |                                                              |
| `Array`                                        | Yes                 | No                    | Array properties cannot contain null elements. If the inner type of the `Array` is not a valid title property, the `Array` property also cannot be used as the title property. Nested arrays are not supported. |
| `Struct`                                       | No                  | No                    | Struct properties do not support nesting, and fields cannot be arrays. |
| `Media Reference`, `Time Series`, `Attachment` | No                  | No                    |                                                              |
| `Geopoint`                                     | Yes                 | No                    |                                                              |
| `Geoshape`                                     | No                  | No                    |                                                              |
| `Marking`                                      | No                  | No                    |                                                              |
| `Cipher`                                       | Yes                 | No                    |                                                              |

