import useCollectionStore from "@/stores/useCollectionStore";
import { useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { useNavigate } from "react-router-dom";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "../ui/context-menu";
import { MoreHorizontal, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import FileIcon from "./FileIcon";

function FileGrid() {
  const navigate = useNavigate();
  const collectionItems = useCollectionStore((state) => state.collectionItems);
  const fetchCollection = useCollectionStore(
    (state) => state.actions.fetchFilesAndFolders
  );
  const deleteItem = useCollectionStore((state) => state.actions.deleteItem);
  const uploadFile = useCollectionStore((state) => state.actions.uploadFile);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      uploadFile(file);
    }
  }, []);

  const { getRootProps } = useDropzone({
    onDrop,
    noClick: true,
  });

  useEffect(() => {
    fetchCollection(undefined);
  }, []);

  return (
    <div className="flex flex-1 w-full overflow-y-auto">
      <div
        className={`w-full flex-1 overflow-y-auto grid grid-cols-auto items-center max-h-[calc(100vh-160px)] md:max-h-min`}
        {...getRootProps()}
      >
        {collectionItems &&
          collectionItems.map((file, i) => {
            const type = file["@type"];
            const isFolder = type === "Collection";

            return (
              <div key={file.identifier} className="p-6">
                {!isFolder ? (
                  <ContextMenu>
                    <ContextMenuTrigger>
                      <div
                        key={i}
                        className={`h-full w-full rounded-lg flex flex-col items-center gap-6 relative p-2 hover:cursor-pointer transition overflow-x-visible z-50 hover:bg-primary-foreground`}
                        onClick={() => {
                          if (file.encodingFormat === "application/pdf")
                            navigate(`/pdf/${file.identifier}`);
                          else if (
                            file.encodingFormat === "image/jpeg" ||
                            file.encodingFormat === "image/png" ||
                            file.encodingFormat === "image/gif" ||
                            file.encodingFormat === "image/webp" ||
                            file.encodingFormat === "image/svg+xml"
                          )
                            navigate(`/image/${file.identifier}`);
                        }}
                      >
                        <div className="flex flex-1 w-full items-center justify-center">
                          <FileIcon type={file.encodingFormat} />
                        </div>

                        <div className="flex w-full flex-col gap-[2px]">
                          <div className="text-md md:text-lg font-normal truncate text-center">
                            {file.name}
                          </div>

                          <small className="text-sm text-gray-500 font-medium leading-none text-center">
                            {new Date(file.datePublished).toLocaleDateString()}
                          </small>
                        </div>

                        {/* <DropdownMenu>
                      <DropdownMenuTrigger>
                        <MoreHorizontal className="hover:bg-gray-200 dark:hover:opacity-80 dark:hover:hover:bg-[#0d0d0d] p-2 h-9 w-9 rounded-full" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="rounded-xl">
                        <DropdownMenuItem
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteItem(file.identifier);
                          }}
                          className="cursor-pointer roun"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu> */}
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteItem(file.identifier);
                        }}
                      >
                        Delete
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ) : (
                  <div
                    key={i}
                    className={`h-14 w-full rounded-lg flex flex-row items-center p-2  hover:cursor-pointer transition overflow-x-visible z-50 hover:bg-primary-foreground`}
                  >
                    <FileIcon type={"folder"} />

                    <div className="flex flex-1 flex-col ml-4 gap-[2px]">
                      <div className="text-md md:text-lg font-normal max-w-[221px] sm:max-w-[400px] xl:max-w-[400px] truncate">
                        {file.name}
                      </div>

                      <small className="text-sm text-gray-500 font-medium leading-none">
                        {file.dateCreated && (
                          <>{new Date(file.dateCreated).toLocaleDateString()}</>
                        )}
                      </small>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger>
                        <MoreHorizontal className="hover:bg-gray-200 dark:hover:opacity-80 dark:hover:hover:bg-[#0d0d0d] p-2 h-9 w-9 rounded-full" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="rounded-xl">
                        <DropdownMenuItem
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteItem(file.identifier);
                          }}
                          className="cursor-pointer roun"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}

export default FileGrid;
