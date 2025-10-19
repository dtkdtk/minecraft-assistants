
/* Import paths must be statically known */

/** Format: `"virtual_path" => lazy async import(real_path)` */
export type VirtualImportsMap = Map<string, () => Promise<any>>;


/**
 * TODO: documentation
 */
export class RestrictedRequireProvider {
  /** Format: `"virtual_path" => import(real_path)` */
  private _moduleCache = new Map<string, any>();

  constructor(
    public virtualPaths: VirtualImportsMap,
  ) {}

  /**
   * @throws {ModuleNotFoundError | ModuleImportException}
   */
  require(virtualPath: string): Promise<any> {
    const maybeCached = this._moduleCache.get(virtualPath);
    if (maybeCached !== undefined) return maybeCached;
    if (!this.virtualPaths.has(virtualPath)) throw new ModuleNotFoundError(virtualPath);
    const moduleData = this.virtualPaths.get(virtualPath)!.call(null)
      .catch(E => { throw new ModuleImportException(virtualPath, E) });
    return moduleData;
  }
}


export class ModuleNotFoundError extends Error {
  constructor(public virtualPath: string) {
    super("Cannot find module: '" + virtualPath + "' (virtual path)");
  }
}
/**
 * Something went wrong during import phase.
 */
export class ModuleImportException extends Error {
  constructor(public virtualPath: string, public error: Error) {
    super("Failed to import module: '" + virtualPath + "' (virtual path)");
  }
}
