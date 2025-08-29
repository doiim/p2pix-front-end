export enum LockStatus { // from DataTypes.sol
  Inexistent = 0, // Uninitialized Lock
  Active = 1, // Valid Lock
  Expired = 2, // Expired Lock
  Released = 3, // Already released Lock
}
